'use client';

import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
// Using Tooltip instead of HoverCard for better compatibility
import { Shield, Eye, Users, Settings, Crown, AlertTriangle } from 'lucide-react';
import { PermissionType } from '@/types/auth';

interface PermissionBadgeProps {
  className?: string;
  showDetails?: boolean;
}

export function PermissionBadge({ className = '', showDetails = true }: PermissionBadgeProps) {
  const { 
    isDevelopmentMode, 
    isAuthDisabled, 
    user,
    permissions,
    hasPermission,
    isSuperuser
  } = useAuthStore();

  // Only show in development mode with auth disabled
  if (!isDevelopmentMode || !isAuthDisabled) {
    return null;
  }

  const getRoleIcon = (userType: string) => {
    switch (userType?.toUpperCase()) {
      case 'SUPERADMIN':
      case 'ADMIN':
        return Crown;
      case 'LANDLORD':
        return Users;
      case 'TENANT':
        return Eye;
      case 'MAINTENANCE':
        return Settings;
      default:
        return Shield;
    }
  };

  const getRoleColor = (userType: string) => {
    switch (userType?.toUpperCase()) {
      case 'SUPERADMIN':
        return 'bg-purple-600';
      case 'ADMIN':
        return 'bg-red-600';
      case 'LANDLORD':
        return 'bg-blue-600';
      case 'TENANT':
        return 'bg-green-600';
      case 'MAINTENANCE':
        return 'bg-orange-600';
      default:
        return 'bg-gray-600';
    }
  };

  const userType = user?.userType || user?.role?.name || 'ADMIN';
  const RoleIcon = getRoleIcon(userType);
  const roleColor = getRoleColor(userType);

  // Test some common permissions
  const testPermissions: PermissionType[] = [
    'CUSTOMER_CREATE', 'CUSTOMER_DELETE', 'INVENTORY_CREATE', 
    'SALE_CREATE', 'RENTAL_CREATE', 'USER_CREATE'
  ];

  const permissionStatus = testPermissions.map(permission => ({
    permission,
    hasAccess: hasPermission(permission)
  }));

  const badge = (
    <Badge 
      variant="outline" 
      className={`${roleColor} text-white border-white/40 hover:bg-opacity-80 transition-all ${className}`}
    >
      <RoleIcon className="w-3 h-3 mr-1" />
      <span className="font-medium">{userType}</span>
      {isSuperuser() && (
        <>
          <span className="mx-1">•</span>
          <Crown className="w-3 h-3" />
        </>
      )}
    </Badge>
  );

  if (!showDetails) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {badge}
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-80 max-w-sm" side="bottom">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${roleColor} rounded-full flex items-center justify-center`}>
                <RoleIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm">Development User Permissions</div>
                <div className="text-xs text-muted-foreground">
                  Role: {userType} {isSuperuser() && '(Superuser)'}
                </div>
              </div>
            </div>

            {/* Permission Summary */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs font-medium mb-2 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Permission Summary
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Total Permissions:</span>
                  <Badge variant="secondary" className="text-xs">
                    {permissions.length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Superuser:</span>
                  <Badge variant={isSuperuser() ? 'default' : 'secondary'} className="text-xs">
                    {isSuperuser() ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Permission Tests */}
            <div>
              <div className="text-xs font-medium mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Sample Permission Tests
              </div>
              <div className="space-y-1">
                {permissionStatus.map(({ permission, hasAccess }) => (
                  <div key={permission} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{permission}</span>
                    <Badge 
                      variant={hasAccess ? 'default' : 'destructive'} 
                      className="text-xs"
                    >
                      {hasAccess ? '✓' : '✗'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t text-xs text-muted-foreground text-center">
              🚨 Development Mode - All permissions are mocked
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PermissionBadge;