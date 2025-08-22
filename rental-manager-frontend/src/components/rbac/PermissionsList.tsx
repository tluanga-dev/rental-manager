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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2,
  Key,
  Shield,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { Permission, PermissionFilters, RISK_LEVELS } from '@/types/rbac';
import { permissionsApi } from '@/services/api/rbac';
import { useAuthStore } from '@/stores/auth-store';
import { PermissionForm } from './PermissionForm';
import { DeletePermissionDialog } from './DeletePermissionDialog';

interface PermissionsListProps {
  onPermissionSelect?: (permission: Permission) => void;
  selectedPermissionId?: string;
  showActions?: boolean;
  roleId?: string; // For filtering permissions by role
}

export function PermissionsList({ 
  onPermissionSelect, 
  selectedPermissionId, 
  showActions = true,
  roleId 
}: PermissionsListProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PermissionFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [resources, setResources] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  const { hasPermission } = useAuthStore();

  const canCreatePermissions = hasPermission('permissions.create');
  const canEditPermissions = hasPermission('permissions.update');
  const canDeletePermissions = hasPermission('permissions.delete');
  const canViewPermissions = hasPermission('permissions.read');

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response = await permissionsApi.list({
        ...filters,
        search: searchTerm || undefined,
        assigned_to_role: roleId || undefined,
        page,
        limit: pageSize
      });
      setPermissions(response.items || response);
      setTotalCount(response.total || response.length);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResourcesAndActions = async () => {
    try {
      const [resourcesData, actionsData] = await Promise.all([
        permissionsApi.getResources(),
        permissionsApi.getActions()
      ]);
      setResources(resourcesData);
      setActions(actionsData);
    } catch (error) {
      console.error('Failed to load resources and actions:', error);
    }
  };

  useEffect(() => {
    if (canViewPermissions) {
      loadPermissions();
    }
  }, [filters, searchTerm, page, roleId, canViewPermissions]);

  useEffect(() => {
    loadResourcesAndActions();
  }, []);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleFilterChange = (newFilters: Partial<PermissionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleCreatePermission = () => {
    setShowCreateForm(true);
  };

  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission);
  };

  const handleDeletePermission = (permission: Permission) => {
    setDeletingPermission(permission);
  };

  const handlePermissionCreated = (permission: Permission) => {
    setPermissions(prev => [permission, ...prev]);
    setShowCreateForm(false);
  };

  const handlePermissionUpdated = (permission: Permission) => {
    setPermissions(prev => prev.map(p => p.id === permission.id ? permission : p));
    setEditingPermission(null);
  };

  const handlePermissionDeleted = (permissionId: string) => {
    setPermissions(prev => prev.filter(p => p.id !== permissionId));
    setDeletingPermission(null);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (permission: Permission) => {
    return (
      <Badge variant={permission.is_active ? "default" : "secondary"}>
        {permission.is_active ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPage(1);
  };

  const hasActiveFilters = Object.keys(filters).some(key => filters[key as keyof PermissionFilters] !== undefined) || searchTerm;

  if (!canViewPermissions) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-gray-600">
              You don't have permission to view permissions.
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
              <Key className="h-5 w-5" />
              Permission Management
              {roleId && (
                <Badge variant="outline" className="ml-2">
                  Role Filtered
                </Badge>
              )}
            </CardTitle>
            {canCreatePermissions && (
              <Button onClick={handleCreatePermission}>
                <Plus className="h-4 w-4 mr-2" />
                Create Permission
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={filters.resource || ''}
                  onValueChange={(value) => handleFilterChange({ 
                    resource: value || undefined 
                  })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Resources</SelectItem>
                    {resources.map((resource) => (
                      <SelectItem key={resource} value={resource}>
                        {resource}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.risk_level || ''}
                  onValueChange={(value) => handleFilterChange({ 
                    risk_level: value as any || undefined 
                  })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Levels</SelectItem>
                    {RISK_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={filters.is_active === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange({ 
                    is_active: filters.is_active === true ? undefined : true 
                  })}
                >
                  Active
                </Button>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    {showActions && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                          <span className="ml-2">Loading permissions...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : permissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-gray-500">
                          <Key className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No permissions found</p>
                          {searchTerm && (
                            <p className="text-sm mt-2">
                              Try adjusting your search or filters
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    permissions.map((permission) => (
                      <TableRow
                        key={permission.id}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selectedPermissionId === permission.id ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => onPermissionSelect?.(permission)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-slate-500" />
                            <span className="font-medium">{permission.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {permission.resource}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {permission.action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${getRiskLevelColor(permission.risk_level)} text-xs`}
                          >
                            {permission.risk_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(permission)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600 truncate max-w-48">
                            {permission.description || 'No description'}
                          </span>
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
                                {canEditPermissions && (
                                  <DropdownMenuItem onClick={() => handleEditPermission(permission)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canDeletePermissions && (
                                  <DropdownMenuItem 
                                    onClick={() => handleDeletePermission(permission)}
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

            {/* Pagination */}
            {totalCount > pageSize && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} permissions
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
          </div>
        </CardContent>
      </Card>

      {showCreateForm && (
        <PermissionForm
          onSuccess={handlePermissionCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {editingPermission && (
        <PermissionForm
          permission={editingPermission}
          onSuccess={handlePermissionUpdated}
          onCancel={() => setEditingPermission(null)}
        />
      )}

      {deletingPermission && (
        <DeletePermissionDialog
          permission={deletingPermission}
          onSuccess={handlePermissionDeleted}
          onCancel={() => setDeletingPermission(null)}
        />
      )}
    </div>
  );
}