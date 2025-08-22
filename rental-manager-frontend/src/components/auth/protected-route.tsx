'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { PermissionType, UserType, getUserTypeDisplayName } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, Crown, User } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: PermissionType | PermissionType[];
  requiredRole?: string;
  requiredUserType?: UserType;
  minimumUserType?: UserType; // User must be this level or higher
  allowSuperuserBypass?: boolean; // Allow superusers to bypass other checks
  fallback?: ReactNode;
  showDetailedError?: boolean; // Show more detailed error information
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requiredRole,
  requiredUserType,
  minimumUserType,
  allowSuperuserBypass = true,
  fallback,
  showDetailedError = false
}: ProtectedRouteProps) {
  const router = useRouter();
  const { 
    isAuthenticated, 
    isLoading, 
    hasPermission, 
    hasRole, 
    hasUserType,
    isSuperuser,
    isAdmin,
    user
  } = useAuthStore();

  useEffect(() => {
    // Only redirect if we're sure the auth state has been loaded and user is not authenticated
    // Add a small delay to ensure hydration completes
    const checkAuth = setTimeout(() => {
      if (!isLoading && !isAuthenticated) {
        console.log('🔐 ProtectedRoute: Not authenticated, redirecting to login');
        router.push('/login');
      }
    }, 100); // Small delay to ensure hydration

    return () => clearTimeout(checkAuth);
  }, [isAuthenticated, isLoading, router]);

  // Show loading state - Important: Show loading during initial hydration
  // This prevents premature redirects while auth state is being loaded from storage
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  // Only after loading is complete to avoid hydration issues
  if (!isAuthenticated) {
    // Show a brief loading state while redirect happens
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Helper function to check if user meets minimum user type requirement
  const meetsMinimumUserType = (required: UserType): boolean => {
    if (!user) return false;
    if (allowSuperuserBypass && isSuperuser()) return true;
    
    const userTypeHierarchy = { SUPERADMIN: 1, ADMIN: 2, USER: 3, CUSTOMER: 4 };
    const userLevel = userTypeHierarchy[user.userType] || 999;
    const requiredLevel = userTypeHierarchy[required] || 999;
    
    return userLevel <= requiredLevel;
  };

  // Helper function to render access denied UI
  const renderAccessDenied = (title: string, message: string, icon = Shield) => {
    const Icon = icon;
    
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Icon className="h-12 w-12 text-red-500" />
              <h2 className="text-lg font-semibold">{title}</h2>
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              
              {showDetailedError && user && (
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Current User Type: {getUserTypeDisplayName(user.userType)}</div>
                  <div>Current Role: {user.role?.name || 'None'}</div>
                  <div>Superuser: {user.isSuperuser ? 'Yes' : 'No'}</div>
                </div>
              )}
              
              <Button 
                onClick={() => router.back()} 
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Check user type requirements (specific type)
  if (requiredUserType && !(allowSuperuserBypass && isSuperuser()) && !hasUserType(requiredUserType)) {
    return renderAccessDenied(
      'Access Denied',
      `You need the user type "${getUserTypeDisplayName(requiredUserType)}" to access this page.`,
      Crown
    );
  }

  // Check minimum user type requirements (hierarchy)
  if (minimumUserType && !meetsMinimumUserType(minimumUserType)) {
    return renderAccessDenied(
      'Insufficient Access Level',
      `You need to be at least a "${getUserTypeDisplayName(minimumUserType)}" to access this page.`,
      Crown
    );
  }

  // Check role requirements
  if (requiredRole && !(allowSuperuserBypass && isSuperuser()) && !hasRole(requiredRole)) {
    return renderAccessDenied(
      'Access Denied',
      `You need the role "${requiredRole}" to access this page.`
    );
  }

  // Check permission requirements
  if (requiredPermissions && !hasPermission(requiredPermissions)) {
    const permissionList = Array.isArray(requiredPermissions) 
      ? requiredPermissions.join(', ') 
      : requiredPermissions;

    return renderAccessDenied(
      'Insufficient Permissions',
      `You need the following permission(s) to access this page: ${permissionList}`
    );
  }

  // Show fallback if provided and no access
  if (fallback && (requiredPermissions || requiredRole)) {
    return <>{fallback}</>;
  }

  // Render children if all checks pass
  return <>{children}</>;
}

// Higher-order component version
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    requiredPermissions?: PermissionType | PermissionType[];
    requiredRole?: string;
    requiredUserType?: UserType;
    minimumUserType?: UserType;
    allowSuperuserBypass?: boolean;
  } = {}
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

// Hook for checking permissions in components
export function usePermissions() {
  const { 
    hasPermission, 
    hasRole, 
    hasUserType,
    canManageUser,
    isSuperuser,
    isAdmin,
    isCustomer,
    user 
  } = useAuthStore();
  
  return {
    hasPermission,
    hasRole,
    hasUserType,
    canManageUser,
    isSuperuser,
    isAdmin,
    isCustomer,
    user,
    can: (permission: PermissionType | PermissionType[]) => hasPermission(permission),
    is: (role: string) => hasRole(role),
    isType: (userType: UserType) => hasUserType(userType),
    canManage: (targetUserType: UserType) => canManageUser(targetUserType),
  };
}

// Component for conditionally rendering content based on permissions
export function PermissionGate({
  children,
  permission,
  role,
  userType,
  minimumUserType,
  fallback = null,
  allowSuperuserBypass = true,
}: {
  children: ReactNode;
  permission?: PermissionType | PermissionType[];
  role?: string;
  userType?: UserType;
  minimumUserType?: UserType;
  fallback?: ReactNode;
  allowSuperuserBypass?: boolean;
}) {
  const { 
    hasPermission, 
    hasRole, 
    hasUserType,
    isSuperuser,
    user 
  } = useAuthStore();

  // Helper function to check minimum user type
  const meetsMinimumUserType = (required: UserType): boolean => {
    if (!user) return false;
    if (allowSuperuserBypass && isSuperuser()) return true;
    
    const userTypeHierarchy = { SUPERADMIN: 1, ADMIN: 2, USER: 3, CUSTOMER: 4 };
    const userLevel = userTypeHierarchy[user.userType] || 999;
    const requiredLevel = userTypeHierarchy[required] || 999;
    
    return userLevel <= requiredLevel;
  };

  // Check all conditions
  const hasAccess = 
    (!permission || hasPermission(permission)) &&
    (!role || (allowSuperuserBypass && isSuperuser()) || hasRole(role)) &&
    (!userType || (allowSuperuserBypass && isSuperuser()) || hasUserType(userType)) &&
    (!minimumUserType || meetsMinimumUserType(minimumUserType));

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}