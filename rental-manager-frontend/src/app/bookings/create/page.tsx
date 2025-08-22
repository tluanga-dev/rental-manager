'use client';

// Force deployment update for production 404 fix - Build timestamp: 2025-01-13
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingRecordingForm } from '@/components/bookings/BookingRecordingForm';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { toast } from 'sonner';

export default function CreateBookingPage() {
  const router = useRouter();

  const handleSuccess = (booking: any) => {
    toast.success('Booking created successfully!');
    router.push('/bookings');
  };

  const handleCancel = () => {
    router.push('/bookings');
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6 max-w-7xl">
      {/* Page Header with Back Button */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/bookings')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bookings
        </Button>
        <h1 className="text-3xl font-bold">Create New Booking</h1>
        <p className="text-gray-600 mt-2">
          Create a new rental booking with multiple items and availability checking
        </p>
      </div>

      {/* Booking Form */}
      <BookingRecordingForm 
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
      </div>
    </ProtectedRoute>
  );
}