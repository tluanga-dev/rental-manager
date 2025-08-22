'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Building2, 
  Search, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  Users, 
  UserX,
  AlertCircle,
  Filter,
  RefreshCw,
  Eye,
  Plus
} from 'lucide-react';
import type { Location, LocationType } from '@/types/location';

interface LocationListProps {
  locations: Location[];
  isLoading?: boolean;
  error?: string;
  onSearch?: (query: string) => void;
  onFilter?: (filters: LocationFilters) => void;
  onRefresh?: () => void;
  onView?: (location: Location) => void;
  onEdit?: (location: Location) => void;
  onDelete?: (location: Location) => void;
  onActivate?: (location: Location) => void;
  onDeactivate?: (location: Location) => void;
  onAssignManager?: (location: Location) => void;
  onRemoveManager?: (location: Location) => void;
}

export interface LocationFilters {
  location_type?: LocationType | 'ALL';
  is_active?: boolean | 'ALL';
  has_manager?: boolean | 'ALL';
}

const locationTypeLabels: Record<LocationType, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  SERVICE_CENTER: 'Service Center',
};

const locationTypeBadgeColors: Record<LocationType, string> = {
  WAREHOUSE: 'bg-slate-100 text-slate-800',
  STORE: 'bg-green-100 text-green-800',
  SERVICE_CENTER: 'bg-orange-100 text-orange-800',
};

export function LocationList({
  locations,
  isLoading = false,
  error,
  onSearch,
  onFilter,
  onRefresh,
  onView,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onAssignManager,
  onRemoveManager,
}: LocationListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<LocationFilters>({
    location_type: 'ALL',
    is_active: 'ALL',
    has_manager: 'ALL',
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleFilterChange = (key: keyof LocationFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getLocationTypeBadge = (type: LocationType) => (
    <Badge className={locationTypeBadgeColors[type]}>
      {locationTypeLabels[type]}
    </Badge>
  );

  const getStatusBadge = (isActive: boolean) => (
    <Badge variant={isActive ? 'default' : 'secondary'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );

  const getManagerBadge = (hasManager: boolean) => (
    <Badge variant={hasManager ? 'outline' : 'secondary'}>
      {hasManager ? 'Assigned' : 'No Manager'}
    </Badge>
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Locations</h2>
          <p className="text-muted-foreground">
            Manage warehouse, store, and service center locations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => router.push('/inventory/locations/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search locations by name or code..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <label className="text-sm font-medium">Location Type</label>
              <Select
                value={filters.location_type || 'ALL'}
                onValueChange={(value) => handleFilterChange('location_type', value === 'ALL' ? undefined : value)}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.is_active === true ? 'ACTIVE' : filters.is_active === false ? 'INACTIVE' : 'ALL'}
                onValueChange={(value) => 
                  handleFilterChange('is_active', 
                    value === 'ACTIVE' ? true : 
                    value === 'INACTIVE' ? false : 
                    undefined
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Manager</label>
              <Select
                value={filters.has_manager === true ? 'HAS_MANAGER' : filters.has_manager === false ? 'NO_MANAGER' : 'ALL'}
                onValueChange={(value) => 
                  handleFilterChange('has_manager', 
                    value === 'HAS_MANAGER' ? true : 
                    value === 'NO_MANAGER' ? false : 
                    undefined
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="HAS_MANAGER">Has Manager</SelectItem>
                  <SelectItem value="NO_MANAGER">No Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Locations Table */}
      <div className="border rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (locations || []).length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No locations found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || Object.values(filters).some(f => f !== 'ALL' && f !== undefined)
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first location'
              }
            </p>
            <Button onClick={() => router.push('/inventory/locations/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(locations || []).map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{location.location_name || location.name || ''}</div>
                      <div className="text-sm text-muted-foreground">{location.location_code || location.code || ''}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getLocationTypeBadge(location.location_type)}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-48">
                      {location.address ? (
                        <div className="text-sm">
                          <div>{location.address}</div>
                          {(location.city || location.state) && (
                            <div className="text-muted-foreground">
                              {[location.city, location.state].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No address</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getManagerBadge(!!location.manager_user_id)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(location.is_active)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDate(location.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDate(location.updated_at)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {onView && (
                        <Button variant="ghost" size="sm" onClick={() => onView(location)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(location)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {location.is_active ? (
                        onDeactivate && (
                          <Button variant="ghost" size="sm" onClick={() => onDeactivate(location)}>
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        )
                      ) : (
                        onActivate && (
                          <Button variant="ghost" size="sm" onClick={() => onActivate(location)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      {location.manager_user_id ? (
                        onRemoveManager && (
                          <Button variant="ghost" size="sm" onClick={() => onRemoveManager(location)}>
                            <UserX className="h-4 w-4" />
                          </Button>
                        )
                      ) : (
                        onAssignManager && (
                          <Button variant="ghost" size="sm" onClick={() => onAssignManager(location)}>
                            <Users className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      {onDelete && !location.is_active && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onDelete(location)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Summary */}
      {(locations || []).length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {(locations || []).length} location{(locations || []).length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}