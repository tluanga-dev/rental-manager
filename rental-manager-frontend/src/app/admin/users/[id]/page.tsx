'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserDetailView } from '@/components/rbac/UserDetailView';
import { UserDeleteDialog } from '@/components/rbac/UserDeleteDialog';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/services/api/users';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch user for delete dialog
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  });

  const handleEdit = () => {
    router.push(`/admin/users/${userId}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    router.push('/admin/users');
  };

  return (
    <ProtectedRoute requiredPermissions={['USER_VIEW']}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Details</h1>
            <p className="text-muted-foreground">
              View and manage user information
            </p>
          </div>
        </div>

        {/* User Detail View */}
        <UserDetailView 
          userId={userId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Delete Dialog */}
        <UserDeleteDialog
          user={user || null}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </ProtectedRoute>
  );
}