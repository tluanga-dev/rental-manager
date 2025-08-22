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
  Users,
  Shield,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  UserX
} from 'lucide-react';
import { UserRole, UserRoleFilters } from '@/types/rbac';
import { userRolesApi } from '@/services/api/rbac';
import { useAuthStore } from '@/stores/auth-store';
import { formatDistanceToNow } from 'date-fns';
import { UserRoleAssignmentForm } from './UserRoleAssignmentForm';

interface UserRolesListProps {
  userId?: string;
  roleId?: string;
  showActions?: boolean;
}

export function UserRolesList({ 
  userId, 
  roleId, 
  showActions = true 
}: UserRolesListProps) {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UserRoleFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const { hasPermission } = useAuthStore();

  const canCreateUserRoles = hasPermission('user_roles.create');
  const canEditUserRoles = hasPermission('user_roles.update');
  const canDeleteUserRoles = hasPermission('user_roles.delete');
  const canViewUserRoles = hasPermission('user_roles.read');

  const loadUserRoles = async () => {
    try {
      setLoading(true);
      const response = await userRolesApi.list({
        ...filters,
        search: searchTerm || undefined,
        user_id: userId || undefined,
        role_id: roleId || undefined,
        page,
        limit: pageSize
      });
      setUserRoles(response.items || response);
      setTotalCount(response.total || response.length);
    } catch (error) {
      console.error('Failed to load user roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewUserRoles) {
      loadUserRoles();
    }
  }, [filters, searchTerm, page, userId, roleId, canViewUserRoles]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleFilterChange = (newFilters: Partial<UserRoleFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleAssignRole = () => {
    setShowAssignmentForm(true);
  };

  const handleRevokeRole = async (userRoleId: string) => {
    try {
      await userRolesApi.revoke(userRoleId);
      setUserRoles(prev => prev.filter(ur => ur.id !== userRoleId));
    } catch (error) {
      console.error('Failed to revoke role:', error);
    }
  };

  const handleExtendRole = async (userRoleId: string) => {
    try {
      const newExpirationDate = new Date();
      newExpirationDate.setMonth(newExpirationDate.getMonth() + 3);
      
      await userRolesApi.update(userRoleId, {
        expires_at: newExpirationDate.toISOString()
      });
      
      loadUserRoles();
    } catch (error) {
      console.error('Failed to extend role:', error);
    }
  };

  const handleToggleActive = async (userRoleId: string, isActive: boolean) => {
    try {
      await userRolesApi.update(userRoleId, {
        is_active: !isActive
      });
      loadUserRoles();
    } catch (error) {
      console.error('Failed to toggle role status:', error);
    }
  };

  const handleAssignmentSuccess = () => {
    setShowAssignmentForm(false);
    loadUserRoles();
  };

  const getStatusBadge = (userRole: UserRole) => {
    const now = new Date();
    const expiresAt = userRole.expires_at ? new Date(userRole.expires_at) : null;
    
    if (!userRole.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    if (expiresAt && expiresAt < now) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    if (expiresAt && expiresAt < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
      return <Badge variant="outline" className="text-orange-600 border-orange-300">Expiring Soon</Badge>;
    }
    
    return <Badge variant="default">Active</Badge>;
  };

  const isExpired = (userRole: UserRole) => {
    return userRole.expires_at && new Date(userRole.expires_at) < new Date();
  };

  const isExpiringSoon = (userRole: UserRole) => {
    const now = new Date();
    const expiresAt = userRole.expires_at ? new Date(userRole.expires_at) : null;
    if (!expiresAt) return false;
    
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return expiresAt < sevenDaysFromNow && expiresAt > now;
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPage(1);
  };

  const hasActiveFilters = Object.keys(filters).some(key => filters[key as keyof UserRoleFilters] !== undefined) || searchTerm;

  if (!canViewUserRoles) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-gray-600">
              You don't have permission to view user role assignments.
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
              <Users className="h-5 w-5" />
              User Role Assignments
              {userId && (
                <Badge variant="outline" className="ml-2">
                  User Filtered
                </Badge>
              )}
              {roleId && (
                <Badge variant="outline" className="ml-2">
                  Role Filtered
                </Badge>
              )}
            </CardTitle>
            {canCreateUserRoles && (
              <Button onClick={handleAssignRole}>
                <Plus className="h-4 w-4 mr-2" />
                Assign Role
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
                  placeholder="Search users or roles..."
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
                  variant={filters.expires_after ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange({ 
                    expires_after: filters.expires_after ? undefined : new Date().toISOString()
                  })}
                >
                  Not Expired
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
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Assigned By</TableHead>
                    {showActions && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                          <span className="ml-2">Loading user roles...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : userRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-gray-500">
                          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No user role assignments found</p>
                          {searchTerm && (
                            <p className="text-sm mt-2">
                              Try adjusting your search or filters
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    userRoles.map((userRole) => (
                      <TableRow
                        key={userRole.id}
                        className={`hover:bg-gray-50 ${
                          isExpired(userRole) ? 'bg-red-50' : 
                          isExpiringSoon(userRole) ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {userRole.user?.full_name || userRole.user?.username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {userRole.user?.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-slate-500" />
                            <span className="font-medium">{userRole.role?.name}</span>
                            {userRole.role?.is_system && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(userRole)}
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
                                isExpired(userRole) ? 'text-red-600' : 
                                isExpiringSoon(userRole) ? 'text-orange-600' : 'text-gray-600'
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
                        {showActions && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEditUserRoles && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handleToggleActive(userRole.id, userRole.is_active)}
                                    >
                                      {userRole.is_active ? (
                                        <>
                                          <UserX className="h-4 w-4 mr-2" />
                                          Deactivate
                                        </>
                                      ) : (
                                        <>
                                          <User className="h-4 w-4 mr-2" />
                                          Activate
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    {userRole.expires_at && (
                                      <DropdownMenuItem 
                                        onClick={() => handleExtendRole(userRole.id)}
                                      >
                                        <Clock className="h-4 w-4 mr-2" />
                                        Extend (3 months)
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                {canDeleteUserRoles && (
                                  <DropdownMenuItem 
                                    onClick={() => handleRevokeRole(userRole.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Revoke
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
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} assignments
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

      {showAssignmentForm && (
        <UserRoleAssignmentForm
          userId={userId}
          roleId={roleId}
          onSuccess={handleAssignmentSuccess}
          onCancel={() => setShowAssignmentForm(false)}
        />
      )}
    </div>
  );
}