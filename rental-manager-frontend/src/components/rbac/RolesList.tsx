'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy, 
  Users,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Role, RoleFilters } from '@/types/rbac';
import { rolesApi } from '@/services/api/rbac';
import { useAuthStore } from '@/stores/auth-store';
import { RoleForm } from './RoleForm';
import { DeleteRoleDialog } from './DeleteRoleDialog';

interface RolesListProps {
  onRoleSelect?: (role: Role) => void;
  selectedRoleId?: string;
  showActions?: boolean;
}

export function RolesList({ 
  onRoleSelect, 
  selectedRoleId, 
  showActions = true 
}: RolesListProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RoleFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const { hasPermission } = useAuthStore();

  const canCreateRoles = hasPermission('roles.create');
  const canEditRoles = hasPermission('roles.update');
  const canDeleteRoles = hasPermission('roles.delete');
  const canViewRoles = hasPermission('roles.read');

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await rolesApi.list({
        ...filters,
        search: searchTerm || undefined,
        page,
        limit: pageSize
      });
      setRoles(response.items || response);
      setTotalCount(response.total || response.length);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewRoles) {
      loadRoles();
    }
  }, [filters, searchTerm, page, canViewRoles]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleFilterChange = (newFilters: Partial<RoleFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleCreateRole = () => {
    setShowCreateForm(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
  };

  const handleDeleteRole = (role: Role) => {
    setDeletingRole(role);
  };

  const handleCloneRole = async (role: Role) => {
    try {
      const clonedRole = await rolesApi.clone(role.id, `${role.name} (Copy)`);
      setRoles(prev => [clonedRole, ...prev]);
    } catch (error) {
      console.error('Failed to clone role:', error);
    }
  };

  const handleRoleCreated = (role: Role) => {
    setRoles(prev => [role, ...prev]);
    setShowCreateForm(false);
  };

  const handleRoleUpdated = (role: Role) => {
    setRoles(prev => prev.map(r => r.id === role.id ? role : r));
    setEditingRole(null);
  };

  const handleRoleDeleted = (roleId: string) => {
    setRoles(prev => prev.filter(r => r.id !== roleId));
    setDeletingRole(null);
  };

  const getRoleStatusBadge = (role: Role) => {
    if (!role.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (role.is_system) {
      return <Badge variant="default">System</Badge>;
    }
    return <Badge variant="outline">Active</Badge>;
  };

  const getRiskLevelColor = (role: Role) => {
    if (role.is_system) return 'text-red-600';
    if (role.permission_count && role.permission_count > 10) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!canViewRoles) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-gray-600">
              You don't have permission to view roles.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Management
            </CardTitle>
            {canCreateRoles && (
              <Button onClick={handleCreateRole}>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filters.is_active === true ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange({ 
                  is_active: filters.is_active === true ? undefined : true 
                })}
              >
                Active
              </Button>
              <Button
                variant={filters.is_system === true ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange({ 
                  is_system: filters.is_system === true ? undefined : true 
                })}
              >
                System
              </Button>
              <Button
                variant={filters.has_users === true ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange({ 
                  has_users: filters.has_users === true ? undefined : true 
                })}
              >
                With Users
              </Button>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Template</TableHead>
                  {showActions && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                        <span className="ml-2">Loading roles...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-gray-500">
                        <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No roles found</p>
                        {searchTerm && (
                          <p className="text-sm mt-2">
                            Try adjusting your search or filters
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow
                      key={role.id}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selectedRoleId === role.id ? 'bg-slate-50' : ''
                      }`}
                      onClick={() => onRoleSelect?.(role)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getRiskLevelColor(role)}`} />
                          <span className="font-medium">{role.name}</span>
                          {role.is_system && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 text-sm">
                          {role.description || 'No description'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getRoleStatusBadge(role)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {role.permission_count || 0} permissions
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{role.user_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.template && (
                          <Badge variant="secondary" className="text-xs">
                            {role.template}
                          </Badge>
                        )}
                      </TableCell>
                      {showActions && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEditRoles && (
                                <DropdownMenuItem onClick={() => handleEditRole(role)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canCreateRoles && (
                                <DropdownMenuItem onClick={() => handleCloneRole(role)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Clone
                                </DropdownMenuItem>
                              )}
                              {canDeleteRoles && role.can_be_deleted && (
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteRole(role)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalCount > pageSize && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} roles
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalCount}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateForm && (
        <RoleForm
          onSuccess={handleRoleCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {editingRole && (
        <RoleForm
          role={editingRole}
          onSuccess={handleRoleUpdated}
          onCancel={() => setEditingRole(null)}
        />
      )}

      {deletingRole && (
        <DeleteRoleDialog
          role={deletingRole}
          onSuccess={handleRoleDeleted}
          onCancel={() => setDeletingRole(null)}
        />
      )}
    </div>
  );
}