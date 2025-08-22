'use client';

import { BookingManagementDashboard } from '@/components/bookings/BookingManagementDashboard';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function BookingsPage() {
  return (
    <ProtectedRoute>
      <BookingManagementDashboard />
    </ProtectedRoute>
  );
}