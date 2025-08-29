'use client';

import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { AlertTriangle, Shield, User, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { UserSwitcher } from '@/components/dev-tools/user-switcher';
import { DevDashboard } from '@/components/dev-tools/dev-dashboard';
import { AuthTestPanel } from '@/components/dev-tools/auth-test-panel';

interface DevModeBannerProps {
  className?: string;
}

export function DevModeBanner({ className = '' }: DevModeBannerProps) {
  const { 
    isDevelopmentMode, 
    isAuthDisabled, 
    user,
    permissions,
    isAuthenticated 
  } = useAuthStore();
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Only show in development mode with auth disabled
  if (!isDevelopmentMode || !isAuthDisabled) {
    return null;
  }

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  return (
    <div className={`bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg border-b-2 border-orange-600 ${className}`}>
      <div className="container mx-auto px-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          {/* Header with two sections - clickable trigger and interactive controls */}
          <div className="flex items-center justify-between py-3">
            {/* Left side - clickable trigger */}
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-3 py-2 px-3 text-white hover:bg-white/10 rounded-md"
                onClick={toggleExpanded}
              >
                <AlertTriangle className="h-5 w-5 animate-pulse" />
                <span className="font-bold text-sm">
                  🚨 DEVELOPMENT MODE - AUTHENTICATION BYPASSED
                </span>
                <Badge variant="destructive" className="bg-red-600 text-white">
                  DEV
                </Badge>
                <Settings className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>

            {/* Right side - interactive controls (outside of button) */}
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-4 w-4" />
                  <span>{user.full_name || user.username}</span>
                  <Badge variant="outline" className="bg-white/20 text-white border-white/40">
                    {user.userType || user.role?.name || 'ADMIN'}
                  </Badge>
                </div>
              )}
              <UserSwitcher />
              <DevDashboard />
              <AuthTestPanel />
            </div>
          </div>
          
          <CollapsibleContent>
            <div className="pb-4 px-4 bg-white/10 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {/* Auth Status */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-semibold">Authentication Status</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Authenticated:</span>
                      <Badge variant={isAuthenticated ? 'default' : 'destructive'} className="text-xs">
                        {isAuthenticated ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Auth Disabled:</span>
                      <Badge variant={isAuthDisabled ? 'destructive' : 'default'} className="text-xs">
                        {isAuthDisabled ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Environment:</span>
                      <Badge variant="outline" className="text-xs bg-white/20 text-white border-white/40">
                        {process.env.NODE_ENV}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4" />
                    <span className="font-semibold">Mock User Info</span>
                  </div>
                  {user ? (
                    <div className="space-y-1 text-xs">
                      <div><span className="font-medium">ID:</span> {user.id}</div>
                      <div><span className="font-medium">Email:</span> {user.email}</div>
                      <div><span className="font-medium">Role:</span> {user.userType || user.role?.name}</div>
                      <div><span className="font-medium">Superuser:</span> {user.is_superuser ? 'Yes' : 'No'}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/80">No user loaded</div>
                  )}
                </div>

                {/* Permissions */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="h-4 w-4" />
                    <span className="font-semibold">Permissions</span>
                  </div>
                  <div className="text-xs">
                    <div className="mb-1">
                      <span className="font-medium">Count:</span> {permissions.length} permissions
                    </div>
                    <div className="max-h-16 overflow-y-auto">
                      <div className="text-white/80 space-y-0.5">
                        {permissions.slice(0, 5).map((permission, index) => (
                          <div key={index} className="truncate">• {permission}</div>
                        ))}
                        {permissions.length > 5 && (
                          <div className="text-white/60">... and {permissions.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-white/20 text-xs text-center text-white/90">
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>This banner only appears in development mode with authentication bypassed</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

export default DevModeBanner;