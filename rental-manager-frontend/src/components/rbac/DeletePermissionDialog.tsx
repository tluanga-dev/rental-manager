'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Shield, 
  Trash2,
  Loader2,
  Key
} from 'lucide-react';
import { Permission } from '@/types/rbac';
import { permissionsApi, rbacValidationApi } from '@/services/api/rbac';

interface DeletePermissionDialogProps {
  permission: Permission;
  onSuccess: (permissionId: string) => void;
  onCancel: () => void;
}

interface DeletionImpact {
  can_delete: boolean;
  role_count: number;
  affected_roles: Array<{ id: string; name: string; user_count: number }>;
  warnings: string[];
}

export function DeletePermissionDialog({ permission, onSuccess, onCancel }: DeletePermissionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  useEffect(() => {
    checkDeletionImpact();
  }, [permission.id]);

  const checkDeletionImpact = async () => {
    try {
      setLoading(true);
      const impactData = await rbacValidationApi.checkPermissionDeletionImpact(permission.id);
      setImpact(impactData);
    } catch (error) {
      console.error('Failed to check deletion impact:', error);
      // Fallback to basic permission data
      setImpact({
        can_delete: true,
        role_count: 0,
        affected_roles: [],
        warnings: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!impact?.can_delete) return;
    
    try {
      setDeleting(true);
      await permissionsApi.delete(permission.id);
      onSuccess(permission.id);
    } catch (error) {
      console.error('Failed to delete permission:', error);
    } finally {
      setDeleting(false);
    }
  };

  const canProceed = impact?.can_delete && 
    (impact.role_count === 0 || confirmationInput === permission.name);

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete Permission
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the permission "{permission.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">Checking deletion impact...</span>
            </div>
          ) : impact ? (
            <div className="space-y-4">
              {/* Permission Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">{permission.name}</span>
                  <Badge 
                    variant="outline" 
                    className={`${getRiskLevelColor(permission.risk_level)} text-xs`}
                  >
                    {permission.risk_level}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Resource:</span> {permission.resource}</p>
                  <p><span className="font-medium">Action:</span> {permission.action}</p>
                  {permission.description && (
                    <p><span className="font-medium">Description:</span> {permission.description}</p>
                  )}
                </div>
              </div>

              {/* Impact Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Affected Roles:</span>
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{impact.role_count}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Can Delete:</span>
                  <Badge variant={impact.can_delete ? "default" : "destructive"}>
                    {impact.can_delete ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>

              {/* Warnings */}
              {impact.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {impact.warnings.map((warning, index) => (
                        <p key={index} className="text-sm">{warning}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Affected Roles List */}
              {impact.affected_roles.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Affected Roles:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {impact.affected_roles.map((role) => (
                      <div key={role.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3 text-gray-400" />
                          <span className="text-sm font-medium">{role.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {role.user_count} users
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    These roles will lose this permission and users may lose access to related features.
                  </div>
                </div>
              )}

              {/* Confirmation Input */}
              {impact.can_delete && impact.role_count > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Type the permission name "{permission.name}" to confirm deletion:
                  </label>
                  <input
                    type="text"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder={permission.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Cannot Delete Warning */}
              {!impact.can_delete && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This permission cannot be deleted. It may have critical dependencies that prevent deletion.
                  </AlertDescription>
                </Alert>
              )}

              {/* High Risk Warning */}
              {permission.risk_level === 'CRITICAL' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This is a CRITICAL permission. Deleting it may severely impact system functionality.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load deletion impact information. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canProceed || deleting}
          >
            {deleting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </div>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permission
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}