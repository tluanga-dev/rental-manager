'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Calendar
} from 'lucide-react';

// Import our components
import { useDueTodayRentals } from './hooks/useDueTodayRentals';
import { DueTodayStats } from './components/DueTodayStats';
import { DueTodayFilters } from './components/DueTodayFilters';
import { DueTodayTable } from './components/DueTodayTable';
import { RentalDetailsModal } from './components/RentalDetailsModal';

import type { DueTodayRental } from '@/types/rentals';

function DueTodayRentalsContent() {
  const router = useRouter();
  const [selectedRental, setSelectedRental] = useState<DueTodayRental | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use our custom hook for data management
  const {
    rentals,
    summary,
    filters,
    hasFilters,
    isLoading,
    isRefreshing,
    isError,
    error,
    updateFilters,
    clearFilters,
    refresh,
    lastUpdated,
  } = useDueTodayRentals({
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Handle rental row click
  const handleRentalClick = useCallback((rental: DueTodayRental) => {
    setSelectedRental(rental);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedRental(null);
  }, []);

  // Handle extend rental action
  const handleExtendRental = useCallback((rentalId: string) => {
    // TODO: Implement extend rental functionality
    console.log('Extend rental:', rentalId);
    // For now, just close the modal and refresh
    handleModalClose();
    refresh();
  }, [handleModalClose, refresh]);

  // Handle mark as returned action
  const handleMarkReturned = useCallback((rentalId: string) => {
    // TODO: Implement mark as returned functionality
    console.log('Mark as returned:', rentalId);
    // For now, just close the modal and refresh
    handleModalClose();
    refresh();
  }, [handleModalClose, refresh]);

  // Handle view full details
  const handleViewFullDetails = useCallback((rentalId: string) => {
    router.push(`/rentals/${rentalId}`);
  }, [router]);

  // Get current date for display
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/rentals')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Rentals
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              Rentals Due Today
            </h1>
            <p className="text-gray-600 flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {currentDate}
              {lastUpdated && (
                <span className="text-sm">
                  • Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {isError && error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="ml-4"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message for No Rentals */}
      {!isLoading && !isError && rentals.length === 0 && !hasFilters && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Great news! There are no rental returns scheduled for today. 
            All customers are up to date with their rentals.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Section */}
      <DueTodayStats 
        summary={summary} 
        isLoading={isLoading}
      />

      {/* Filters Section */}
      <DueTodayFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onClearFilters={clearFilters}
        onRefresh={refresh}
        locations={summary.locations}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
      />

      {/* Table Section */}
      <DueTodayTable
        rentals={rentals}
        onRentalClick={handleRentalClick}
        isLoading={isLoading}
      />

      {/* No Results Message with Filters */}
      {!isLoading && !isError && rentals.length === 0 && hasFilters && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              No rentals found matching your current filters. 
              Try adjusting your search criteria or clearing filters.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="ml-4"
            >
              Clear Filters
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Rental Details Modal */}
      <RentalDetailsModal
        rental={selectedRental}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExtendRental={handleExtendRental}
        onMarkReturned={handleMarkReturned}
        onViewFullDetails={handleViewFullDetails}
      />

      {/* Auto-refresh indicator */}
      {!isError && (
        <div className="fixed bottom-4 right-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex items-center gap-2 text-sm text-gray-600">
            <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
            <span>
              {isRefreshing ? 'Updating...' : 'Auto-refresh active'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DueTodayRentalsPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['RENTAL_VIEW']}>
        <DueTodayRentalsContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}