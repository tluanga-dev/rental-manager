'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Key, 
  X, 
  Save, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { 
  Permission, 
  PermissionFormData, 
  CreatePermissionRequest, 
  UpdatePermissionRequest,
  RISK_LEVELS,
  RISK_LEVEL_DESCRIPTIONS
} from '@/types/rbac';
import { permissionsApi } from '@/services/api/rbac';

interface PermissionFormProps {
  permission?: Permission;
  onSuccess: (permission: Permission) => void;
  onCancel: () => void;
}

export function PermissionForm({ permission, onSuccess, onCancel }: PermissionFormProps) {
  const [formData, setFormData] = useState<PermissionFormData>({
    name: '',
    description: '',
    resource: '',
    action: '',
    risk_level: 'LOW'
  });
  const [resources, setResources] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isEditing = !!permission;

  useEffect(() => {
    if (permission) {
      setFormData({
        name: permission.name,
        description: permission.description || '',
        resource: permission.resource,
        action: permission.action,
        risk_level: permission.risk_level
      });
    }
  }, [permission]);

  useEffect(() => {
    loadResourcesAndActions();
  }, []);

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

  const handleInputChange = (field: keyof PermissionFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Permission name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Permission name must be at least 3 characters';
    }
    
    if (!formData.resource.trim()) {
      errors.resource = 'Resource is required';
    }
    
    if (!formData.action.trim()) {
      errors.action = 'Action is required';
    }
    
    if (!formData.risk_level) {
      errors.risk_level = 'Risk level is required';
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
      
      if (isEditing && permission) {
        const updateData: UpdatePermissionRequest = {
          name: formData.name,
          description: formData.description || undefined,
          resource: formData.resource,
          action: formData.action,
          risk_level: formData.risk_level,
          is_active: true
        };
        
        const updatedPermission = await permissionsApi.update(permission.id, updateData);
        onSuccess(updatedPermission);
      } else {
        const createData: CreatePermissionRequest = {
          name: formData.name,
          description: formData.description || undefined,
          resource: formData.resource,
          action: formData.action,
          risk_level: formData.risk_level
        };
        
        const newPermission = await permissionsApi.create(createData);
        onSuccess(newPermission);
      }
    } catch (error) {
      console.error('Failed to save permission:', error);
      // Handle API errors
      if (error instanceof Error) {
        setValidationErrors({ general: error.message });
      }
    } finally {
      setLoading(false);
    }
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

  const generatePermissionName = () => {
    if (formData.resource && formData.action) {
      const suggestedName = `${formData.resource}.${formData.action}`;
      setFormData(prev => ({
        ...prev,
        name: suggestedName
      }));
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {isEditing ? 'Edit Permission' : 'Create New Permission'}
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
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-800">{validationErrors.general}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="resource">Resource *</Label>
              <Select
                value={formData.resource}
                onValueChange={(value) => handleInputChange('resource', value)}
              >
                <SelectTrigger className={validationErrors.resource ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select resource" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.resource && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.resource}</p>
              )}
            </div>

            <div>
              <Label htmlFor="action">Action *</Label>
              <Select
                value={formData.action}
                onValueChange={(value) => handleInputChange('action', value)}
              >
                <SelectTrigger className={validationErrors.action ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.action && (
                <p className="text-sm text-red-600 mt-1">{validationErrors.action}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="name">Permission Name *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generatePermissionName}
                disabled={!formData.resource || !formData.action}
              >
                Generate Name
              </Button>
            </div>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., products.create"
              className={validationErrors.name ? 'border-red-500' : ''}
            />
            {validationErrors.name && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Convention: resource.action (e.g., products.create, users.read)
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what this permission allows"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="risk_level">Risk Level *</Label>
            <Select
              value={formData.risk_level}
              onValueChange={(value) => handleInputChange('risk_level', value)}
            >
              <SelectTrigger className={validationErrors.risk_level ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select risk level" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`${getRiskLevelColor(level)} text-xs`}
                      >
                        {level}
                      </Badge>
                      <span className="text-sm">
                        {RISK_LEVEL_DESCRIPTIONS[level]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.risk_level && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.risk_level}</p>
            )}
          </div>

          {/* Risk Level Information */}
          {formData.risk_level && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-600 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      variant="outline" 
                      className={`${getRiskLevelColor(formData.risk_level)} text-xs`}
                    >
                      {formData.risk_level}
                    </Badge>
                    <span className="text-sm font-medium text-slate-900">
                      Risk Level Information
                    </span>
                  </div>
                  <p className="text-sm text-slate-800">
                    {RISK_LEVEL_DESCRIPTIONS[formData.risk_level]}
                  </p>
                </div>
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
                  Saving...
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Permission' : 'Create Permission'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}