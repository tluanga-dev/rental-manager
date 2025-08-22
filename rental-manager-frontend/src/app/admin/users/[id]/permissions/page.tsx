'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, Settings } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { usersApi } from '@/services/api/users';
import { useQuery } from '@tanstack/react-query';

export default function UserPermissionsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  });

  const { data: effectivePermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => usersApi.getUserEffectivePermissions(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-600">User Not Found</h2>
              <p className="text-gray-600 mt-2">The requested user could not be found.</p>
              <Button 
                onClick={() => router.back()} 
                variant="outline" 
                className="mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredPermissions={['PERMISSION_VIEW']}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">User Permissions</h1>
              <p className="text-muted-foreground">
                Manage permissions for {user.name}
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/admin/users/${userId}/edit`)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Edit User
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Effective Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading permissions...</p>
                </div>
              ) : effectivePermissions?.allPermissions?.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Total: {effectivePermissions.allPermissions.length} permissions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {effectivePermissions.allPermissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No permissions assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Permission Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {effectivePermissions && (
                <>
                  {/* Role Permissions */}
                  <div>
                    <h4 className="font-medium mb-2">From Role</h4>
                    {effectivePermissions.rolePermissions?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {effectivePermissions.rolePermissions.map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No role permissions</p>
                    )}
                  </div>

                  {/* Direct Permissions */}
                  <div>
                    <h4 className="font-medium mb-2">Direct Permissions</h4>
                    {effectivePermissions.directPermissions?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {effectivePermissions.directPermissions.map((permission) => (
                          <Badge key={permission} variant="default" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No direct permissions</p>
                    )}
                  </div>

                  {/* User Type Info */}
                  <div>
                    <h4 className="font-medium mb-2">User Type</h4>
                    <Badge variant="outline">
                      {effectivePermissions.userType}
                    </Badge>
                    {effectivePermissions.isSuperuser && (
                      <Badge variant="destructive" className="ml-2">
                        Superuser
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                Advanced permission management tools will be implemented here.
                <br />
                This would include role assignment, direct permission grants, and permission auditing.
              </p>
              <div className="flex justify-center space-x-4">
                <Button variant="outline">
                  Assign Role
                </Button>
                <Button variant="outline">
                  Grant Permission
                </Button>
                <Button variant="outline">
                  View Audit Log
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}