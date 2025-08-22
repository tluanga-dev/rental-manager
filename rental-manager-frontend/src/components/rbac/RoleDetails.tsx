'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Shield, 
  Users, 
  Key, 
  Edit, 
  Trash2, 
  UserPlus,
  AlertTriangle,
  Calendar,
  Clock,
  User
} from 'lucide-react';
import { Role, Permission, UserRole } from '@/types/rbac';
import { rolesApi } from '@/services/api/rbac';
import { useAuthStore } from '@/stores/auth-store';
import { formatDistanceToNow } from 'date-fns';

interface RoleDetailsProps {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
  onAssignUser: (role: Role) => void;
}

export function RoleDetails({ role, onEdit, onDelete, onAssignUser }: RoleDetailsProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const { hasPermission } = useAuthStore();

  const canEditRoles = hasPermission('roles.update');
  const canDeleteRoles = hasPermission('roles.delete');
  const canAssignRoles = hasPermission('user_roles.create');

  useEffect(() => {
    loadRoleDetails();
  }, [role.id]);

  const loadRoleDetails = async () => {
    try {
      setLoading(true);
      const [permissionsData, usersData] = await Promise.all([
        rolesApi.getPermissions(role.id),
        rolesApi.getUsers(role.id)
      ]);
      setPermissions(permissionsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load role details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (role: Role) => {
    if (!role.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (role.is_system) {
      return <Badge variant="destructive">System Role</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const groupPermissionsByResource = (permissions: Permission[]) => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach(permission => {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = [];
      }
      grouped[permission.resource].push(permission);
    });
    return grouped;
  };

  const riskLevelStats = permissions.reduce((acc, perm) => {
    acc[perm.risk_level] = (acc[perm.risk_level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeUsers = users.filter(u => u.is_active);
  const expiredUsers = users.filter(u => u.expires_at && new Date(u.expires_at) < new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-slate-600" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  {role.name}
                  {role.is_system && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {role.description || 'No description provided'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canAssignRoles && (
                <Button variant="outline" onClick={() => onAssignUser(role)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign User
                </Button>
              )}
              {canEditRoles && (
                <Button variant="outline" onClick={() => onEdit(role)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {canDeleteRoles && role.can_be_deleted && (
                <Button variant="outline" onClick={() => onDelete(role)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-600">{permissions.length}</div>
              <div className="text-sm text-gray-600">Permissions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{activeUsers.length}</div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{expiredUsers.length}</div>
              <div className="text-sm text-gray-600">Expired Users</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center">
                {getStatusBadge(role)}
              </div>
              <div className="text-sm text-gray-600">Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Role Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{role.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Template:</span>
                  <span className="font-medium">{role.template || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">System Role:</span>
                  <Badge variant={role.is_system ? "destructive" : "outline"}>
                    {role.is_system ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Can Be Deleted:</span>
                  <Badge variant={role.can_be_deleted ? "default" : "secondary"}>
                    {role.can_be_deleted ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(role.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(role.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Permission Risk Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(riskLevelStats).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getRiskLevelColor(level)}`} />
                        <span className="text-sm">{level}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(riskLevelStats).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No permissions assigned
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permissions ({permissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                  <span className="ml-2">Loading permissions...</span>
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No permissions assigned to this role</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupPermissionsByResource(permissions)).map(([resource, resourcePermissions]) => (
                    <div key={resource} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {resource} ({resourcePermissions.length})
                      </h4>
                      <div className="grid gap-2">
                        {resourcePermissions.map((permission) => (
                          <div key={permission.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{permission.name}</span>
                                <Badge className={`text-xs ${getRiskLevelColor(permission.risk_level)}`}>
                                  {permission.risk_level}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600">{permission.action}</p>
                              {permission.description && (
                                <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assigned Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                  <span className="ml-2">Loading users...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No users assigned to this role</p>
                  {canAssignRoles && (
                    <Button className="mt-4" onClick={() => onAssignUser(role)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign User
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Assigned By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((userRole) => (
                        <TableRow key={userRole.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">
                                {userRole.user?.full_name || userRole.user?.username}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {userRole.user?.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={userRole.is_active ? "default" : "secondary"}>
                              {userRole.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">
                                {formatDistanceToNow(new Date(userRole.assigned_at), { addSuffix: true })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {userRole.expires_at ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                <span className={`text-sm ${
                                  new Date(userRole.expires_at) < new Date() 
                                    ? 'text-red-600' 
                                    : 'text-gray-600'
                                }`}>
                                  {formatDistanceToNow(new Date(userRole.expires_at), { addSuffix: true })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {userRole.assigned_by_user?.full_name || userRole.assigned_by_user?.username || 'System'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}