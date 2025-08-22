'use client';

import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ConnectionStatusDemo } from '@/components/demo/connection-status-demo';

export default function DemoPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute>
        <ConnectionStatusDemo />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}
