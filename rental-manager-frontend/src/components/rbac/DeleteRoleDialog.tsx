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
  Users, 
  Shield, 
  Trash2,
  Loader2
} from 'lucide-react';
import { Role } from '@/types/rbac';
import { rolesApi, rbacValidationApi } from '@/services/api/rbac';

interface DeleteRoleDialogProps {
  role: Role;
  onSuccess: (roleId: string) => void;
  onCancel: () => void;
}

interface DeletionImpact {
  can_delete: boolean;
  user_count: number;
  affected_users: Array<{ id: string; username: string; email: string }>;
  system_role: boolean;
  warnings: string[];
}

export function DeleteRoleDialog({ role, onSuccess, onCancel }: DeleteRoleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  useEffect(() => {
    checkDeletionImpact();
  }, [role.id]);

  const checkDeletionImpact = async () => {
    try {
      setLoading(true);
      const impactData = await rbacValidationApi.checkRoleDeletionImpact(role.id);
      setImpact(impactData);
    } catch (error) {
      console.error('Failed to check deletion impact:', error);
      // Fallback to basic role data
      setImpact({
        can_delete: role.can_be_deleted,
        user_count: role.user_count || 0,
        affected_users: [],
        system_role: role.is_system,
        warnings: role.is_system ? ['This is a system role and may be critical for system operation'] : []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!impact?.can_delete) return;
    
    try {
      setDeleting(true);
      await rolesApi.delete(role.id);
      onSuccess(role.id);
    } catch (error) {
      console.error('Failed to delete role:', error);
    } finally {
      setDeleting(false);
    }
  };

  const canProceed = impact?.can_delete && 
    (impact.user_count === 0 || confirmationInput === role.name);

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete Role
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the role "{role.name}"? This action cannot be undone.
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
              {/* Role Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">{role.name}</span>
                  {role.is_system && (
                    <Badge variant="destructive">System Role</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {role.description || 'No description provided'}
                </p>
              </div>

              {/* Impact Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Affected Users:</span>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{impact.user_count}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Permissions:</span>
                  <span className="text-sm">{role.permission_count || 0}</span>
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

              {/* Affected Users List */}
              {impact.affected_users.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">Affected Users:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {impact.affected_users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between text-sm">
                        <span>{user.username}</span>
                        <span className="text-gray-500">{user.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation Input */}
              {impact.can_delete && impact.user_count > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Type the role name "{role.name}" to confirm deletion:
                  </label>
                  <input
                    type="text"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder={role.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Cannot Delete Warning */}
              {!impact.can_delete && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This role cannot be deleted. It may be a system role or have dependencies that prevent deletion.
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
                Delete Role
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}