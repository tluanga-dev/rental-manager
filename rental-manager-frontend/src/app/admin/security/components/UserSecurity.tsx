'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { securityApi, UserSecurityInfo, Role } from '@/services/api/security';
import { usersApi } from '@/services/api/users';
import { toast } from 'react-hot-toast';
import {
  Search,
  Shield,
  Users,
  Lock,
  Unlock,
  Key,
  Activity,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  roles?: string[];
}

export default function UserSecurity() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSecurityInfo, setUserSecurityInfo] = useState<UserSecurityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [showRoleAssignDialog, setShowRoleAssignDialog] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        usersApi.getAll({ page: 1, size: 100 }),
        securityApi.getAllRoles(),
      ]);
      setUsers(usersData.data || []);
      setRoles(rolesData);
    } catch (error) {
      console.error('Failed to load user security data:', error);
      toast.error('Failed to load user security data');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSecurityInfo = async (userId: string) => {
    try {
      const info = await securityApi.getUserSecurityInfo(userId);
      setUserSecurityInfo(info);
    } catch (error) {
      console.error('Failed to load user security info:', error);
      toast.error('Failed to load user security information');
    }
  };

  const viewUserSecurity = async (user: User) => {
    setSelectedUser(user);
    await loadUserSecurityInfo(user.id);
    setShowSecurityDialog(true);
  };

  const openRoleAssignment = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles || []);
    setShowRoleAssignDialog(true);
  };

  const handleBulkRoleAssignment = async () => {
    if (!selectedUser) return;

    try {
      // Get current user roles
      const currentRoles = selectedUser.roles || [];
      
      // Find roles to add and remove
      const rolesToAdd = selectedRoles.filter(r => !currentRoles.includes(r));
      const rolesToRemove = currentRoles.filter(r => !selectedRoles.includes(r));

      // Perform bulk assignment
      if (rolesToAdd.length > 0) {
        await securityApi.bulkAssignRoles({
          user_ids: [selectedUser.id],
          role_ids: rolesToAdd,
          action: 'add',
        });
      }

      if (rolesToRemove.length > 0) {
        await securityApi.bulkAssignRoles({
          user_ids: [selectedUser.id],
          role_ids: rolesToRemove,
          action: 'remove',
        });
      }

      toast.success('Roles updated successfully');
      setShowRoleAssignDialog(false);
      loadData();
    } catch (error) {
      console.error('Failed to update user roles:', error);
      toast.error('Failed to update user roles');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getStatusBadge = (user: User) => {
    if (user.is_superuser) {
      return <Badge className="bg-purple-100 text-purple-800">Superuser</Badge>;
    }
    if (user.is_active) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Inactive</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Security Management</CardTitle>
              <CardDescription>
                Manage user roles, permissions, and security settings
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.full_name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles && user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No roles</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(user)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewUserSecurity(user)}
                      >
                        <Activity className="h-4 w-4 mr-1" />
                        Security
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRoleAssignment(user)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Roles
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Security Dialog */}
      <Dialog open={showSecurityDialog} onOpenChange={setShowSecurityDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>User Security Information</DialogTitle>
            <DialogDescription>
              Complete security profile for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          {userSecurityInfo && (
            <div className="space-y-6">
              {/* Security Status */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Account Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userSecurityInfo.is_locked ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <Lock className="h-4 w-4" />
                        <span>Locked</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <Unlock className="h-4 w-4" />
                        <span>Active</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      2FA Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userSecurityInfo.two_factor_enabled ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <Key className="h-4 w-4" />
                        <span>Enabled</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Disabled</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Active Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userSecurityInfo.active_sessions}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Failed Logins
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {userSecurityInfo.failed_login_attempts}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Roles and Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Assigned Roles</h3>
                  <div className="space-y-2">
                    {userSecurityInfo.roles.length > 0 ? (
                      userSecurityInfo.roles.map((role) => (
                        <div key={role} className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary">{role}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No roles assigned</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Effective Permissions</h3>
                  <div className="max-h-48 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {userSecurityInfo.effective_permissions.length > 0 ? (
                        userSecurityInfo.effective_permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No permissions</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Last Login */}
              {userSecurityInfo.last_login && (
                <div>
                  <Label className="text-muted-foreground">Last Login</Label>
                  <div className="font-medium">
                    {new Date(userSecurityInfo.last_login).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={showRoleAssignDialog} onOpenChange={setShowRoleAssignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Roles</DialogTitle>
            <DialogDescription>
              Select roles to assign to {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={role.id}
                      checked={selectedRoles.includes(role.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles([...selectedRoles, role.id]);
                        } else {
                          setSelectedRoles(selectedRoles.filter(r => r !== role.id));
                        }
                      }}
                    />
                    <Label htmlFor={role.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{role.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {role.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {role.permissions.length} permissions
                      </div>
                    </Label>
                    {role.is_system_role && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRoleAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkRoleAssignment}>
                Update Roles
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}