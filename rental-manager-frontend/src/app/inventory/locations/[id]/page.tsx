'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Edit, 
  Power, 
  PowerOff, 
  Trash2,
  ArrowLeft,
  Calendar,
  Users,
  UserX,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { locationsApi } from '@/services/api/locations';
import type { Location, LocationType } from '@/types/location';

interface LocationDetailPageProps {
  params: {
    id: string;
  };
}

const locationTypeLabels: Record<LocationType, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  SERVICE_CENTER: 'Service Center',
  OTHER: 'Other',
};

const locationTypeColors: Record<LocationType, string> = {
  WAREHOUSE: 'bg-slate-100 text-slate-800',
  STORE: 'bg-green-100 text-green-800',
  SERVICE_CENTER: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export default function LocationDetailPage({ params }: LocationDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addNotification } = useAppStore();

  // Fetch location details
  const { 
    data: location, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['locations', params.id],
    queryFn: () => locationsApi.getById(params.id),
  });

  // Activate location mutation
  const activateMutation = useMutation({
    mutationFn: () => locationsApi.activate(params.id),
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
    mutationFn: () => locationsApi.deactivate(params.id),
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
    mutationFn: () => locationsApi.delete(params.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      addNotification({
        type: 'success',
        title: 'Location Deleted',
        message: 'Location has been deleted successfully'
      });
      router.push('/inventory/locations');
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: error.response?.data?.detail || 'Failed to delete location'
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  const formatAddress = (location: Location) => {
    const parts = [
      location.address,
      location.city,
      location.state,
      location.country,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'No address provided';
  };

  const getLocationTypeBadge = (type: LocationType) => (
    <Badge className={locationTypeColors[type]}>
      {locationTypeLabels[type]}
    </Badge>
  );

  const getStatusBadge = (isActive: boolean) => (
    <Badge variant={isActive ? 'default' : 'secondary'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );

  const handleEdit = () => {
    router.push(`/inventory/locations/${params.id}/edit`);
  };

  const handleDelete = () => {
    if (!location) return;
    
    if (location.is_active) {
      addNotification({
        type: 'error',
        title: 'Cannot Delete',
        message: 'Cannot delete an active location. Please deactivate it first.'
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${location.location_name}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleActivate = () => {
    activateMutation.mutate();
  };

  const handleDeactivate = () => {
    if (!location) return;
    
    if (window.confirm(`Are you sure you want to deactivate "${location.location_name}"?`)) {
      deactivateMutation.mutate();
    }
  };

  const handleAssignManager = () => {
    router.push(`/inventory/locations/${params.id}/assign-manager`);
  };

  const handleRemoveManager = async () => {
    if (!location) return;
    
    if (window.confirm(`Are you sure you want to remove the manager from "${location.location_name}"?`)) {
      try {
        await locationsApi.removeManager(params.id);
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

  const handleBack = () => {
    router.push('/inventory/locations');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || 'Location not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Locations
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{location.location_name}</h1>
            <p className="text-muted-foreground">{location.location_code}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getLocationTypeBadge(location.location_type)}
          {getStatusBadge(location.is_active)}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Basic Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location Code</label>
                  <p className="font-medium">{location.location_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location Name</label>
                  <p className="font-medium">{location.location_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <div className="mt-1">
                    {getLocationTypeBadge(location.location_type)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(location.is_active)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Address Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Address</label>
                  <p className="mt-1">{formatAddress(location)}</p>
                </div>
                {location.postal_code && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Postal Code</label>
                    <p className="mt-1">{location.postal_code}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {location.contact_number && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p>{location.contact_number}</p>
                  </div>
                </div>
              )}
              
              {location.email && (
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{location.email}</p>
                  </div>
                </div>
              )}

              {!location.contact_number && !location.email && (
                <p className="text-muted-foreground">No contact information provided</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleEdit} 
                className="w-full"
                variant="outline"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Location
              </Button>

              {location.is_active ? (
                <Button 
                  onClick={handleDeactivate} 
                  className="w-full"
                  variant="outline"
                  disabled={deactivateMutation.isPending}
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
                </Button>
              ) : (
                <Button 
                  onClick={handleActivate} 
                  className="w-full"
                  variant="outline"
                  disabled={activateMutation.isPending}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {activateMutation.isPending ? 'Activating...' : 'Activate'}
                </Button>
              )}

              {!location.is_active && (
                <Button 
                  onClick={handleDelete} 
                  className="w-full"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Location'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Manager Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Manager</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {location.manager_user_id ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Manager assigned</p>
                  <Button 
                    onClick={handleRemoveManager} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Remove Manager
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">No manager assigned</p>
                  <Button 
                    onClick={handleAssignManager} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign Manager
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-sm">{formatDate(location.created_at)}</p>
              </div>
              
              {location.updated_at !== location.created_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-sm">{formatDate(location.updated_at)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}