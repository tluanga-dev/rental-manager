'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Key,
  UserX,
  UserCheck,
  Shield,
  Eye,
  Download,
  Trash2,
} from 'lucide-react';
import { UserDeleteDialog } from '@/components/rbac/UserDeleteDialog';

import { useAuthStore } from '@/stores/auth-store';
import { usersApi } from '@/services/api/users';
import { User, UserType, getUserTypeDisplayName } from '@/types/auth';

function UsersContent() {
  const router = useRouter();
  const { user: currentUser, canManageUser, hasPermission } = useAuthStore();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserType, setSelectedUserType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || undefined,
        userType: selectedUserType === 'all' ? undefined : selectedUserType,
        isActive: selectedStatus === 'all' ? undefined : selectedStatus === 'active',
      };

      const response = await usersApi.getUsers(params);
      setUsers(response.items || response.users || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.limit, searchTerm, selectedUserType, selectedStatus]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (type: 'userType' | 'status', value: string) => {
    if (type === 'userType') {
      setSelectedUserType(value);
    } else {
      setSelectedStatus(value);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleUserAction = async (userId: string, action: string, user?: User) => {
    try {
      switch (action) {
        case 'activate':
          await usersApi.activateUser(userId);
          break;
        case 'deactivate':
          await usersApi.deactivateUser(userId);
          break;
        case 'edit':
          router.push(`/admin/users/${userId}/edit`);
          return;
        case 'delete':
          if (user) {
            setUserToDelete(user);
            setDeleteDialogOpen(true);
          }
          return;
        case 'view':
          router.push(`/admin/users/${userId}/view`);
          return;
        case 'permissions':
          router.push(`/admin/users/${userId}/permissions`);
          return;
        case 'sessions':
          router.push(`/admin/users/${userId}/sessions`);
          return;
        default:
          return;
      }
      
      // Refresh the user list after action
      fetchUsers();
    } catch (error) {
      console.error(`Error performing ${action} on user:`, error);
    }
  };

  const handleDeleteSuccess = () => {
    fetchUsers();
    setUserToDelete(null);
  };

  const getUserTypeBadge = (userType: UserType) => {
    const colors = {
      SUPERADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      ADMIN: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      USER: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
      CUSTOMER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };

    return (
      <Badge className={colors[userType]}>
        {getUserTypeDisplayName(userType)}
      </Badge>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge
        className={
          isActive
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        }
      >
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  const canModifyUser = (targetUser: User) => {
    if (!currentUser) return false;
    
    // Can't modify yourself (except through profile)
    if (targetUser.id === currentUser.id) return false;
    
    // Check user type hierarchy
    return canManageUser(targetUser.userType);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        
        {hasPermission('USER_CREATE') && (
          <Button onClick={() => router.push('/admin/users/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedUserType} onValueChange={(value) => handleFilterChange('userType', value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {hasPermission('USER_VIEW') && (
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Users ({pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No users found matching your criteria
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.username !== user.email && (
                            <div className="text-xs text-gray-400">@{user.username}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getUserTypeBadge(user.userType)}
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <div>
                            <div className="font-medium text-sm">{user.role.name}</div>
                            {user.role.description && (
                              <div className="text-xs text-gray-500">{user.role.description}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">No role assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(user.isActive)}
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? (
                          <div className="text-sm">
                            {new Date(user.lastLogin).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            
                            {hasPermission('USER_VIEW') && (
                              <DropdownMenuItem onClick={() => handleUserAction(user.id, 'view')}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            )}

                            {canModifyUser(user) && hasPermission('USER_UPDATE') && (
                              <DropdownMenuItem onClick={() => handleUserAction(user.id, 'edit', user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                            )}

                            {canModifyUser(user) && hasPermission('PERMISSION_ASSIGN') && (
                              <DropdownMenuItem onClick={() => handleUserAction(user.id, 'permissions')}>
                                <Shield className="mr-2 h-4 w-4" />
                                Manage Permissions
                              </DropdownMenuItem>
                            )}

                            {hasPermission('USER_VIEW_SESSIONS') && (
                              <DropdownMenuItem onClick={() => handleUserAction(user.id, 'sessions')}>
                                <Key className="mr-2 h-4 w-4" />
                                View Sessions
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {canModifyUser(user) && (
                              <>
                                {user.isActive ? (
                                  hasPermission('USER_DEACTIVATE') && (
                                    <DropdownMenuItem 
                                      onClick={() => handleUserAction(user.id, 'deactivate', user)}
                                      className="text-orange-600"
                                    >
                                      <UserX className="mr-2 h-4 w-4" />
                                      Deactivate
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  hasPermission('USER_ACTIVATE') && (
                                    <DropdownMenuItem 
                                      onClick={() => handleUserAction(user.id, 'activate', user)}
                                      className="text-green-600"
                                    >
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Activate
                                    </DropdownMenuItem>
                                  )
                                )}
                                
                                {hasPermission('USER_DELETE') && (
                                  <DropdownMenuItem 
                                    onClick={() => handleUserAction(user.id, 'delete', user)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete User
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} users
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page * pagination.limit >= pagination.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete User Dialog */}
      <UserDeleteDialog
        user={userToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute requiredPermissions={['USER_VIEW']}>
      <UsersContent />
    </ProtectedRoute>
  );
}