'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Shield, 
  X, 
  Save, 
  AlertTriangle, 
  Search,
  Plus,
  Minus
} from 'lucide-react';
import { Role, Permission, RoleFormData, CreateRoleRequest, UpdateRoleRequest } from '@/types/rbac';
import { rolesApi, permissionsApi } from '@/services/api/rbac';

interface RoleFormProps {
  role?: Role;
  onSuccess: (role: Role) => void;
  onCancel: () => void;
}

export function RoleForm({ role, onSuccess, onCancel }: RoleFormProps) {
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    template: '',
    permission_ids: []
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionFilters, setPermissionFilters] = useState({
    resource: '',
    risk_level: ''
  });

  const isEditing = !!role;

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        template: role.template || '',
        permission_ids: role.permissions?.map(p => p.id) || []
      });
    }
  }, [role]);

  useEffect(() => {
    loadPermissions();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (role?.permissions) {
      setSelectedPermissions(role.permissions);
    }
  }, [role]);

  useEffect(() => {
    filterAvailablePermissions();
  }, [permissions, selectedPermissions, permissionSearch, permissionFilters]);

  const loadPermissions = async () => {
    try {
      const response = await permissionsApi.list({
        is_active: true,
        page: 1,
        limit: 1000
      });
      setPermissions(response.items || response);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const templateList = await rolesApi.getTemplates();
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const filterAvailablePermissions = () => {
    const selectedIds = selectedPermissions.map(p => p.id);
    let filtered = permissions.filter(p => !selectedIds.includes(p.id));

    if (permissionSearch) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
        p.description?.toLowerCase().includes(permissionSearch.toLowerCase()) ||
        p.resource.toLowerCase().includes(permissionSearch.toLowerCase())
      );
    }

    if (permissionFilters.resource) {
      filtered = filtered.filter(p => p.resource === permissionFilters.resource);
    }

    if (permissionFilters.risk_level) {
      filtered = filtered.filter(p => p.risk_level === permissionFilters.risk_level);
    }

    setAvailablePermissions(filtered);
  };

  const handleInputChange = (field: keyof RoleFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPermission = (permission: Permission) => {
    setSelectedPermissions(prev => [...prev, permission]);
    setFormData(prev => ({
      ...prev,
      permission_ids: [...prev.permission_ids, permission.id]
    }));
  };

  const handleRemovePermission = (permissionId: string) => {
    setSelectedPermissions(prev => prev.filter(p => p.id !== permissionId));
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.filter(id => id !== permissionId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    try {
      setLoading(true);
      
      if (isEditing && role) {
        const updateData: UpdateRoleRequest = {
          name: formData.name,
          description: formData.description || undefined,
          template: formData.template || undefined,
          is_active: true
        };
        
        const updatedRole = await rolesApi.update(role.id, updateData);
        
        // Update permissions separately
        if (formData.permission_ids.length > 0) {
          await rolesApi.assignPermissions({
            role_id: role.id,
            permission_ids: formData.permission_ids
          });
        }
        
        onSuccess(updatedRole);
      } else {
        const createData: CreateRoleRequest = {
          name: formData.name,
          description: formData.description || undefined,
          template: formData.template || undefined,
          permission_ids: formData.permission_ids.length > 0 ? formData.permission_ids : undefined
        };
        
        const newRole = await rolesApi.create(createData);
        onSuccess(newRole);
      }
    } catch (error) {
      console.error('Failed to save role:', error);
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

  const uniqueResources = [...new Set(permissions.map(p => p.resource))];
  const uniqueRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isEditing ? 'Edit Role' : 'Create New Role'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Role Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Sales Manager"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the role's responsibilities and scope"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="template">Template</Label>
                <Select
                  value={formData.template}
                  onValueChange={(value) => handleInputChange('template', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template} value={template}>
                        {template}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {role?.is_system && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    This is a system role. Some changes may be restricted.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label>Selected Permissions ({selectedPermissions.length})</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {selectedPermissions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No permissions selected
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedPermissions.map((permission) => (
                        <div key={permission.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{permission.name}</span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getRiskLevelColor(permission.risk_level)}`}
                              >
                                {permission.risk_level}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 truncate">
                              {permission.resource} • {permission.action}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePermission(permission.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Available Permissions</Label>
              <div className="flex gap-2">
                <Select
                  value={permissionFilters.resource}
                  onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, resource: value }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Resources</SelectItem>
                    {uniqueResources.map((resource) => (
                      <SelectItem key={resource} value={resource}>
                        {resource}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={permissionFilters.risk_level}
                  onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, risk_level: value }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Levels</SelectItem>
                    {uniqueRiskLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search permissions..."
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {availablePermissions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No permissions available
                </p>
              ) : (
                <div className="p-2 space-y-1">
                  {availablePermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => handleAddPermission(permission)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{permission.name}</span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getRiskLevelColor(permission.risk_level)}`}
                          >
                            {permission.risk_level}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {permission.resource} • {permission.action}
                        </p>
                        {permission.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {permission.description}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Role' : 'Create Role'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}