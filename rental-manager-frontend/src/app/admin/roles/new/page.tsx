'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, SaveIcon, ShieldCheckIcon } from 'lucide-react';
import { rbacApi } from '@/services/api/rbac';
import { Permission, CreateRoleRequest } from '@/types/rbac';
import { toast } from 'react-hot-toast';

const RISK_LEVEL_COLORS = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 border-red-200'
};

const TEMPLATES = [
  { value: '', label: 'No Template' },
  { value: 'system', label: 'System Administration' },
  { value: 'management', label: 'Management' },
  { value: 'operational', label: 'Operational' },
  { value: 'financial', label: 'Financial' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'service', label: 'Customer Service' },
  { value: 'audit', label: 'Audit' },
  { value: 'guest', label: 'Guest' }
];

export default function NewRolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [formData, setFormData] = useState<CreateRoleRequest>({
    name: '',
    description: '',
    template: '',
    permission_ids: []
  });
  const [selectedResource, setSelectedResource] = useState<string>('all');
  const [resources, setResources] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoadingPermissions(true);
      const response = await rbacApi.permissions.list({ limit: 500 });
      const perms = response.data || response;
      setPermissions(perms);
      
      // Extract unique resources
      const uniqueResources = [...new Set(perms.map((p: Permission) => p.resource))];
      setResources(uniqueResources.sort());
    } catch (error) {
      console.error('Failed to load permissions:', error);
      toast.error('Failed to load permissions');
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      setLoading(true);
      await rbacApi.roles.create(formData);
      toast.success('Role created successfully');
      router.push('/admin/roles');
    } catch (error: any) {
      console.error('Failed to create role:', error);
      toast.error(error.response?.data?.detail || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids?.includes(permissionId)
        ? prev.permission_ids.filter(id => id !== permissionId)
        : [...(prev.permission_ids || []), permissionId]
    }));
  };

  const selectAllInResource = (resource: string) => {
    const resourcePerms = permissions.filter(p => p.resource === resource);
    const allSelected = resourcePerms.every(p => formData.permission_ids?.includes(p.id));
    
    if (allSelected) {
      // Deselect all
      setFormData(prev => ({
        ...prev,
        permission_ids: prev.permission_ids?.filter(
          id => !resourcePerms.some(p => p.id === id)
        ) || []
      }));
    } else {
      // Select all
      const newIds = resourcePerms.map(p => p.id);
      setFormData(prev => ({
        ...prev,
        permission_ids: [...new Set([...(prev.permission_ids || []), ...newIds])]
      }));
    }
  };

  const filteredPermissions = permissions.filter(p => {
    const matchesResource = selectedResource === 'all' || p.resource === selectedResource;
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesResource && matchesSearch;
  });

  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/admin/roles')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Role</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Define a new role with specific permissions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Role Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g., Regional Manager"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Describe the purpose and responsibilities of this role"
                />
              </div>
              <div>
                <label htmlFor="template" className="block text-sm font-medium text-gray-700">
                  Template
                </label>
                <select
                  id="template"
                  value={formData.template || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  {TEMPLATES.map(template => (
                    <option key={template.value} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-lg font-medium text-gray-900">Permissions</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select the permissions this role should have
              </p>
            </div>

            {/* Permission Filters */}
            <div className="mb-4 flex space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <select
                value={selectedResource}
                onChange={(e) => setSelectedResource(e.target.value)}
                className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All Resources</option>
                {resources.map(resource => (
                  <option key={resource} value={resource}>
                    {resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Count */}
            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                {formData.permission_ids?.length || 0} permissions selected
              </p>
            </div>

            {/* Permission Groups */}
            {loadingPermissions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource} className="border border-gray-200 rounded-lg">
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">
                        {resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ')}
                      </h3>
                      <button
                        type="button"
                        onClick={() => selectAllInResource(resource)}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        {perms.every(p => formData.permission_ids?.includes(p.id))
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perms.map(permission => (
                        <label
                          key={permission.id}
                          className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.permission_ids?.includes(permission.id) || false}
                            onChange={() => togglePermission(permission.id)}
                            className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {permission.name}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${RISK_LEVEL_COLORS[permission.risk_level]}`}>
                                {permission.risk_level}
                              </span>
                            </div>
                            {permission.description && (
                              <p className="text-xs text-gray-500 mt-1">
                                {permission.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/admin/roles')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <SaveIcon className="mr-2 h-4 w-4" />
                  Create Role
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}