'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Edit, 
  Eye, 
  Power, 
  PowerOff 
} from 'lucide-react';
import type { Location, LocationType } from '@/types/location';

interface LocationCardProps {
  location: Location;
  onView?: (location: Location) => void;
  onEdit?: (location: Location) => void;
  onActivate?: (location: Location) => void;
  onDeactivate?: (location: Location) => void;
  showActions?: boolean;
  compact?: boolean;
}

const locationTypeLabels: Record<LocationType, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  SERVICE_CENTER: 'Service Center',
};

const locationTypeColors: Record<LocationType, string> = {
  WAREHOUSE: 'bg-slate-100 text-slate-800',
  STORE: 'bg-green-100 text-green-800',
  SERVICE_CENTER: 'bg-orange-100 text-orange-800',
};

export function LocationCard({
  location,
  onView,
  onEdit,
  onActivate,
  onDeactivate,
  showActions = true,
  compact = false,
}: LocationCardProps) {
  const formatAddress = () => {
    const parts = [
      location.address,
      location.city,
      location.state,
      location.country,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'No address provided';
  };

  const getLocationTypeBadge = () => (
    <Badge className={locationTypeColors[location.location_type]}>
      {locationTypeLabels[location.location_type]}
    </Badge>
  );

  const getStatusBadge = () => (
    <Badge variant={location.is_active ? 'default' : 'secondary'}>
      {location.is_active ? 'Active' : 'Inactive'}
    </Badge>
  );

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView?.(location)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{location.location_name || location.name || ''}</div>
                <div className="text-sm text-muted-foreground">{location.location_code || location.code || ''}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getLocationTypeBadge()}
              {getStatusBadge()}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{location.location_name || location.name || ''}</CardTitle>
            <div className="text-sm text-muted-foreground">{location.location_code || location.code || ''}</div>
          </div>
          <div className="flex items-center space-x-2">
            {getLocationTypeBadge()}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Address */}
        <div className="flex items-start space-x-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="text-muted-foreground">{formatAddress()}</div>
            {location.postal_code && (
              <div className="text-muted-foreground">{location.postal_code}</div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-2">
          {(location.contact_number || location.contact_phone) && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{location.contact_number || location.contact_phone}</span>
            </div>
          )}

          {(location.email || location.contact_email) && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{location.email || location.contact_email}</span>
            </div>
          )}          {location.contact_person && (
            <div className="flex items-center space-x-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{location.contact_person}</span>
            </div>
          )}
        </div>

        {/* Manager */}
        <div className="flex items-center space-x-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            {location.manager_user_id ? (
              <span>Manager assigned</span>
            ) : (
              <span className="text-muted-foreground">No manager assigned</span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Created {new Date(location.created_at).toLocaleDateString('en-IN')}
          </div>
          {location.updated_at !== location.created_at && (
            <div className="text-xs text-muted-foreground">
              Updated {new Date(location.updated_at).toLocaleDateString('en-IN')}
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-end space-x-2 pt-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={() => onView(location)}>
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(location)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {location.is_active ? (
              onDeactivate && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDeactivate(location)}
                  className="text-orange-600 hover:text-orange-700"
                >
                  <PowerOff className="h-4 w-4 mr-1" />
                  Deactivate
                </Button>
              )
            ) : (
              onActivate && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onActivate(location)}
                  className="text-green-600 hover:text-green-700"
                >
                  <Power className="h-4 w-4 mr-1" />
                  Activate
                </Button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}