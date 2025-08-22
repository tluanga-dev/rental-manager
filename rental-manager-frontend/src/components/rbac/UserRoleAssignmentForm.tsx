'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  UserPlus, 
  X, 
  Save, 
  Search,
  Calendar,
  Shield,
  User,
  Users
} from 'lucide-react';
import { Role, UserRoleAssignmentData, AssignRoleRequest } from '@/types/rbac';
import { rolesApi, userRolesApi } from '@/services/api/rbac';
import { format } from 'date-fns';

interface UserRoleAssignmentFormProps {
  userId?: string;
  roleId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface UserOption {
  id: string;
  username: string;
  email: string;
  full_name: string;
  userType: string;
}

export function UserRoleAssignmentForm({ 
  userId, 
  roleId, 
  onSuccess, 
  onCancel 
}: UserRoleAssignmentFormProps) {
  const [formData, setFormData] = useState<UserRoleAssignmentData>({
    user_id: userId || '',
    role_ids: roleId ? [roleId] : [],
    expires_at: undefined
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [expirationDate, setExpirationDate] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRoles();
    if (!userId) {
      loadUsers();
    }
  }, [userId]);

  useEffect(() => {
    if (userId && users.length > 0) {
      const user = users.find(u => u.id === userId);
      if (user) {
        setSelectedUsers([user]);
      }
    }
  }, [userId, users]);

  useEffect(() => {
    if (roleId && roles.length > 0) {
      const role = roles.find(r => r.id === roleId);
      if (role) {
        setSelectedRoles([role]);
      }
    }
  }, [roleId, roles]);

  const loadRoles = async () => {
    try {
      const response = await rolesApi.list({
        is_active: true,
        page: 1,
        limit: 100
      });
      setRoles(response.items || response);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadUsers = async () => {
    try {
      // This would typically be a users API call
      // For now, we'll use a placeholder
      const mockUsers: UserOption[] = [
        {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Administrator',
          userType: 'ADMIN'
        },
        {
          id: '2',
          username: 'manager',
          email: 'manager@example.com',
          full_name: 'Manager User',
          userType: 'MANAGER'
        },
        {
          id: '3',
          username: 'employee',
          email: 'employee@example.com',
          full_name: 'Employee User',
          userType: 'EMPLOYEE'
        }
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleUserSelect = (user: UserOption) => {
    if (userId) return; // Single user mode
    
    const isSelected = selectedUsers.some(u => u.id === user.id);
    if (isSelected) {
      setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers(prev => [...prev, user]);
    }
  };

  const handleRoleSelect = (role: Role) => {
    if (roleId) return; // Single role mode
    
    const isSelected = selectedRoles.some(r => r.id === role.id);
    if (isSelected) {
      setSelectedRoles(prev => prev.filter(r => r.id !== role.id));
    } else {
      setSelectedRoles(prev => [...prev, role]);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (selectedUsers.length === 0) {
      errors.users = 'At least one user must be selected';
    }
    
    if (selectedRoles.length === 0) {
      errors.roles = 'At least one role must be selected';
    }
    
    if (expirationDate && new Date(expirationDate) <= new Date()) {
      errors.expiration = 'Expiration date must be in the future';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Create assignments for each user-role combination
      const assignments: AssignRoleRequest[] = [];
      
      for (const user of selectedUsers) {
        for (const role of selectedRoles) {
          assignments.push({
            user_id: user.id,
            role_id: role.id,
            expires_at: expirationDate || undefined
          });
        }
      }
      
      // Execute all assignments
      await Promise.all(
        assignments.map(assignment => userRolesApi.assign(assignment))
      );
      
      onSuccess();
    } catch (error) {
      console.error('Failed to assign roles:', error);
      setValidationErrors({ general: 'Failed to assign roles. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Roles to Users
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {validationErrors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <span className="text-sm text-red-800">{validationErrors.general}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Select Users</Label>
                {validationErrors.users && (
                  <p className="text-sm text-red-600">{validationErrors.users}</p>
                )}
              </div>
              
              {userId ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Single User Mode</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Assigning roles to a specific user
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUsers.some(u => u.id === user.id)}
                                onCheckedChange={() => handleUserSelect(user)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">{user.full_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">{user.email}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.userType}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Selected Users ({selectedUsers.length})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {user.full_name}
                        {!userId && (
                          <button
                            type="button"
                            onClick={() => handleUserSelect(user)}
                            className="ml-1 text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Roles Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Select Roles</Label>
                {validationErrors.roles && (
                  <p className="text-sm text-red-600">{validationErrors.roles}</p>
                )}
              </div>
              
              {roleId ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Single Role Mode</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Assigning a specific role to users
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRoles.some(r => r.id === role.id)}
                              onCheckedChange={() => handleRoleSelect(role)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-slate-500" />
                              <span className="font-medium">{role.name}</span>
                              {role.is_system && (
                                <Badge variant="destructive" className="text-xs">System</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 truncate">
                              {role.description || 'No description'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{role.user_count || 0}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedRoles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Selected Roles ({selectedRoles.length})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoles.map((role) => (
                      <Badge key={role.id} variant="secondary" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {role.name}
                        {!roleId && (
                          <button
                            type="button"
                            onClick={() => handleRoleSelect(role)}
                            className="ml-1 text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label htmlFor="expiration" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expiration Date (Optional)
            </Label>
            <Input
              id="expiration"
              type="datetime-local"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className={validationErrors.expiration ? 'border-red-500' : ''}
            />
            {validationErrors.expiration && (
              <p className="text-sm text-red-600">{validationErrors.expiration}</p>
            )}
            <p className="text-sm text-gray-500">
              Leave empty for permanent assignment
            </p>
          </div>

          {/* Summary */}
          {selectedUsers.length > 0 && selectedRoles.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-2">Assignment Summary</h4>
              <div className="text-sm text-slate-800 space-y-1">
                <p>• {selectedUsers.length} user(s) will be assigned {selectedRoles.length} role(s)</p>
                <p>• Total assignments: {selectedUsers.length * selectedRoles.length}</p>
                {expirationDate && (
                  <p>• Expires: {format(new Date(expirationDate), 'PPp')}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Assigning...
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Assign Roles
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}