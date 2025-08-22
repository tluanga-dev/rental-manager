'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { LocationList, type LocationFilters } from '@/components/locations/location-list';
import { locationsApi } from '@/services/api/locations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Location } from '@/types/location';

export default function LocationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addNotification } = useAppStore();
  const [filters, setFilters] = useState<LocationFilters>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch locations
  const { 
    data: locationsData = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['locations', filters, searchQuery],
    queryFn: async () => {
      const params: any = {};
      
      if (filters.location_type && filters.location_type !== 'ALL') {
        params.location_type = filters.location_type;
      }
      
      if (filters.is_active !== undefined && filters.is_active !== 'ALL') {
        params.active_only = filters.is_active;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      return locationsApi.list(params);
    },
  });

  // Ensure locations is always an array - handle both direct array and paginated response
  const locations = Array.isArray(locationsData) 
    ? locationsData 
    : (locationsData?.items && Array.isArray(locationsData.items)) 
      ? locationsData.items 
      : [];

  // Calculate statistics
  const stats = useMemo(() => {
    const total = locations.length;
    const active = locations.filter(l => l.is_active).length;
    const withManager = locations.filter(l => l.manager_user_id).length;
    
    // Calculate recent locations (created in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentLocations = locations.filter(l => {
      if (!l.created_at) return false;
      const createdDate = new Date(l.created_at);
      return createdDate > thirtyDaysAgo;
    }).length;

    return {
      total,
      active,
      withManager,
      recentLocations
    };
  }, [locations]);

  // Debug logging
  console.log('📊 LocationsPage render:', {
    locationsData,
    locations,
    locationsLength: locations.length,
    isLoading,
    error: error?.message,
    hasError: !!error
  });

  // Activate location mutation
  const activateMutation = useMutation({
    mutationFn: (locationId: string) => locationsApi.activate(locationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      addNotification({
        type: 'success',
        title: 'Location Activated',
        message: `Location "${data.location_name}" has been activated`
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Activation Failed',
        message: error.response?.data?.detail || 'Failed to activate location'
      });
    },
  });

  // Deactivate location mutation
  const deactivateMutation = useMutation({
    mutationFn: (locationId: string) => locationsApi.deactivate(locationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      addNotification({
        type: 'success',
        title: 'Location Deactivated',
        message: `Location "${data.location_name}" has been deactivated`
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Deactivation Failed',
        message: error.response?.data?.detail || 'Failed to deactivate location'
      });
    },
  });


  // Delete location mutation
  const deleteMutation = useMutation({
    mutationFn: (locationId: string) => locationsApi.delete(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      addNotification({
        type: 'success',
        title: 'Location Deleted',
        message: 'Location has been deleted successfully'
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.response?.data?.detail || 'Failed to delete location'
      });
    },
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilter = (newFilters: LocationFilters) => {
    setFilters(newFilters);
  };

  const handleView = (location: Location) => {
    router.push(`/inventory/locations/${location.id}`);
  };

  const handleEdit = (location: Location) => {
    router.push(`/inventory/locations/${location.id}/edit`);
  };

  const handleDelete = async (location: Location) => {
    if (location.is_active) {
      addNotification({
        type: 'error',
        title: 'Cannot Delete',
        message: 'Cannot delete an active location. Please deactivate it first.'
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${location.location_name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(location.id);
    }
  };

  const handleActivate = (location: Location) => {
    activateMutation.mutate(location.id);
  };

  const handleDeactivate = (location: Location) => {
    if (window.confirm(`Are you sure you want to deactivate "${location.location_name}"?`)) {
      deactivateMutation.mutate(location.id);
    }
  };

  const handleAssignManager = (location: Location) => {
    // Navigate to manager assignment page
    router.push(`/inventory/locations/${location.id}/assign-manager`);
  };

  const handleRemoveManager = async (location: Location) => {
    if (window.confirm(`Are you sure you want to remove the manager from "${location.location_name}"?`)) {
      try {
        await locationsApi.removeManager(location.id);
        queryClient.invalidateQueries({ queryKey: ['locations'] });
        addNotification({
          type: 'success',
          title: 'Manager Removed',
          message: 'Manager has been removed from the location'
        });
      } catch (error: any) {
        addNotification({
          type: 'error',
          title: 'Remove Manager Failed',
          message: error.response?.data?.detail || 'Failed to remove manager'
        });
      }
    }
  };


  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.total}
            </div>
            <p className="text-xs text-muted-foreground">All registered locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.active}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.withManager}
            </div>
            <p className="text-xs text-muted-foreground">Have assigned managers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats.recentLocations}
            </div>
            <p className="text-xs text-muted-foreground">Recent additions</p>
          </CardContent>
        </Card>
      </div>

      <LocationList
        locations={locations}
        isLoading={isLoading}
        error={error?.message}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onRefresh={handleRefresh}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        onAssignManager={handleAssignManager}
        onRemoveManager={handleRemoveManager}
      />
    </div>
  );
}