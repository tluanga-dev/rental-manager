'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { UserForm } from '@/components/rbac';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function NewUserPage() {
  const router = useRouter();

  const handleSuccess = (user: any) => {
    // Redirect to users list or user detail page
    router.push('/admin/users');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ProtectedRoute requiredPermissions={['USER_CREATE']}>
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
              <h1 className="text-2xl font-bold tracking-tight">Create New User</h1>
              <p className="text-muted-foreground">
                Add a new user to the system with appropriate roles and permissions.
              </p>
            </div>
          </div>
        </div>

        {/* User Form */}
        <UserForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </ProtectedRoute>
  );
}