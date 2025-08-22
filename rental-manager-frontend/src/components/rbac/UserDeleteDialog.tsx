'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/api/users';
import { toast } from 'sonner';
import { User } from '@/types/auth';

interface UserDeleteDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserDeleteDialog({ user, open, onOpenChange, onSuccess }: UserDeleteDialogProps) {
  const queryClient = useQueryClient();

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.deleteUser(userId),
    onSuccess: () => {
      toast.success(`User "${user?.name}" has been deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete user';
      toast.error(errorMessage);
    },
  });

  const handleDelete = () => {
    if (user?.id) {
      deleteUserMutation.mutate(user.id);
    }
  };

  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <AlertDialogTitle>Delete User</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to delete the user <strong>{user.name}</strong> ({user.email})?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
              <p className="font-medium text-red-800 mb-1">Warning:</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>This action cannot be undone</li>
                <li>All user data will be permanently removed</li>
                <li>User sessions will be terminated</li>
                <li>Associated permissions and roles will be removed</li>
              </ul>
            </div>
            {user.userType === 'ADMIN' || user.userType === 'SUPERADMIN' ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm">
                <p className="font-medium text-yellow-800">
                  ⚠️ This is an administrator account
                </p>
                <p className="text-yellow-700 mt-1">
                  Deleting this account may affect system administration capabilities.
                </p>
              </div>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteUserMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteUserMutation.isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {deleteUserMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete User'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default UserDeleteDialog;