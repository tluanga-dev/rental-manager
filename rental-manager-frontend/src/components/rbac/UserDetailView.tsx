'use client';

import React, { useState } from 'react';
import { 
  User, 
  UserRole, 
  UserSession, 
  DirectPermissionGrant,
  AuditLog 
} from '@/types/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/api/users';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User as UserIcon, 
  Shield, 
  Key, 
  Activity, 
  Clock, 
  MapPin,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface UserDetailViewProps {
  userId: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function UserDetailView({ userId, onEdit, onDelete }: UserDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch user data
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  });

  // Fetch user sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['user-sessions', userId],
    queryFn: () => usersApi.getUserSessions(userId),
    enabled: !!userId && activeTab === 'sessions',
  });

  // Fetch user permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => usersApi.getUserEffectivePermissions(userId),
    enabled: !!userId && activeTab === 'permissions',
  });

  // Fetch direct permissions
  const { data: directPermissions } = useQuery({
    queryKey: ['user-direct-permissions', userId],
    queryFn: () => usersApi.getUserDirectPermissions(userId),
    enabled: !!userId && activeTab === 'permissions',
  });

  // Fetch audit logs
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['user-audit', userId],
    queryFn: () => usersApi.getUserAuditLogs(userId, { limit: 50 }),
    enabled: !!userId && activeTab === 'activity',
  });

  // Terminate session mutation
  const terminateSessionMutation = useMutation({
    mutationFn: (sessionId: string) => usersApi.terminateUserSession(userId, sessionId),
    onSuccess: () => {
      toast.success('Session terminated successfully');
      queryClient.invalidateQueries({ queryKey: ['user-sessions', userId] });
    },
    onError: () => {
      toast.error('Failed to terminate session');
    },
  });

  // Terminate all sessions mutation
  const terminateAllSessionsMutation = useMutation({
    mutationFn: () => usersApi.terminateAllUserSessions(userId),
    onSuccess: () => {
      toast.success('All sessions terminated successfully');
      queryClient.invalidateQueries({ queryKey: ['user-sessions', userId] });
    },
    onError: () => {
      toast.error('Failed to terminate sessions');
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: (newPassword: string) => usersApi.resetUserPassword(userId, newPassword),
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: () => {
      toast.error('Failed to reset password');
    },
  });

  // Activate/Deactivate user mutations
  const toggleUserStatusMutation = useMutation({
    mutationFn: (activate: boolean) => 
      activate ? usersApi.activateUser(userId) : usersApi.deactivateUser(userId),
    onSuccess: (_, activate) => {
      toast.success(`User ${activate ? 'activated' : 'deactivated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
    onError: () => {
      toast.error('Failed to update user status');
    },
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium">User not found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUserTypeColor = (type: string) => {
    const colors = {
      SUPERADMIN: 'bg-red-100 text-red-800',
      ADMIN: 'bg-orange-100 text-orange-800',
      USER: 'bg-blue-100 text-blue-800',
      CUSTOMER: 'bg-green-100 text-green-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* User Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <CardDescription className="space-y-1 mt-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </div>
                  {user.username && user.username !== user.email && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      @{user.username}
                    </div>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getUserTypeColor(user.userType)}>
                {user.userType}
              </Badge>
              <Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Created</p>
              <p className="font-medium">
                {user.createdAt ? format(new Date(user.createdAt), 'PPP') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Last Login</p>
              <p className="font-medium">
                {user.lastLogin 
                  ? formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Role</p>
              <p className="font-medium">
                {user.roles?.[0]?.name || 'No role assigned'}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => router.push(`/admin/users/${userId}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit User
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleUserStatusMutation.mutate(!user.isActive)}
              disabled={toggleUserStatusMutation.isPending}
            >
              {user.isActive ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/admin/users/${userId}/permissions`)}
            >
              <Shield className="h-4 w-4 mr-2" />
              Manage Permissions
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed information */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">User ID</p>
                  <p className="font-mono text-sm">{user.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Username</p>
                  <p className="font-medium">{user.username || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">
                    {user.location?.location_name || 'No location assigned'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Account Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {user.isActive ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium">
                    {user.createdAt 
                      ? format(new Date(user.createdAt), 'PPpp')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Updated At</p>
                  <p className="font-medium">
                    {user.updatedAt 
                      ? format(new Date(user.updatedAt), 'PPpp')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Login</p>
                  <p className="font-medium">
                    {user.lastLogin 
                      ? format(new Date(user.lastLogin), 'PPpp')
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Login Count</p>
                  <p className="font-medium">{user.loginCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Effective Permissions</CardTitle>
              <CardDescription>
                All permissions available to this user through roles and direct grants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : permissions ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">User Type</p>
                    <Badge className={getUserTypeColor(permissions.userType)}>
                      {permissions.userType}
                    </Badge>
                    {permissions.isSuperuser && (
                      <Badge className="ml-2 bg-red-100 text-red-800">
                        Superuser
                      </Badge>
                    )}
                  </div>
                  
                  {permissions.rolePermissions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">
                        Role Permissions ({permissions.rolePermissions.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {permissions.rolePermissions.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {directPermissions && directPermissions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">
                        Direct Permissions ({directPermissions.length})
                      </p>
                      <div className="space-y-2">
                        {directPermissions.map((grant: DirectPermissionGrant) => (
                          <div key={grant.id} className="flex items-center justify-between p-2 border rounded">
                            <Badge className="text-xs">{grant.permissionCode}</Badge>
                            {grant.expiresAt && (
                              <span className="text-xs text-gray-500">
                                Expires: {format(new Date(grant.expiresAt), 'PPp')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">
                      All Permissions ({permissions.allPermissions.length})
                    </p>
                    <ScrollArea className="h-48 w-full border rounded p-2">
                      <div className="flex flex-wrap gap-1">
                        {permissions.allPermissions.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <p>No permissions data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage user login sessions across devices
                  </CardDescription>
                </div>
                {sessions && sessions.length > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => terminateAllSessionsMutation.mutate()}
                    disabled={terminateAllSessionsMutation.isPending}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Terminate All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((session: UserSession) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={session.isActive ? 'default' : 'secondary'}>
                              {session.isActive ? 'Active' : 'Expired'}
                            </Badge>
                            {session.isCurrent && (
                              <Badge variant="outline">Current</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{session.userAgent || 'Unknown device'}</p>
                          <p className="text-xs text-gray-500">
                            IP: {session.ipAddress || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Created: {format(new Date(session.createdAt), 'PPpp')}
                          </p>
                          {session.lastActivity && (
                            <p className="text-xs text-gray-500">
                              Last activity: {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        {!session.isCurrent && session.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => terminateSessionMutation.mutate(session.id)}
                            disabled={terminateSessionMutation.isPending}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">No active sessions</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Recent actions and changes for this user
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : auditLogs && auditLogs.logs && auditLogs.logs.length > 0 ? (
                <ScrollArea className="h-96 w-full">
                  <div className="space-y-3">
                    {auditLogs.logs.map((log: AuditLog) => (
                      <div key={log.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{log.action}</p>
                            <p className="text-xs text-gray-500">
                              {log.resource} • {log.resourceId}
                            </p>
                            {log.details && (
                              <p className="text-xs text-gray-600 mt-1">
                                {JSON.stringify(log.details)}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-center text-gray-500 py-4">No activity logs available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UserDetailView;