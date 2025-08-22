'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserEditForm } from '@/components/rbac/UserEditForm';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const handleSuccess = (updatedUser: any) => {
    router.push('/admin/users');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ProtectedRoute requiredPermissions={['USER_UPDATE']}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
              <p className="text-muted-foreground">
                Update user information and permissions
              </p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <UserEditForm 
          userId={userId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </ProtectedRoute>
  );
}