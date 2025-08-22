'use client';

// Loading skeleton components for improved UX
import React from 'react';

// Skeleton loader utility component
const SkeletonBox = ({ className = "", animate = true }: { className?: string, animate?: boolean }) => (
  <div className={`bg-gray-200 rounded ${animate ? 'animate-pulse' : ''} ${className}`} />
);

// Rental details page skeleton
export const RentalDetailsLoadingSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      
      {/* Header Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <SkeletonBox className="w-32 h-6" />
              <div className="h-6 w-px bg-gray-300" />
              <SkeletonBox className="w-48 h-8" />
              <SkeletonBox className="w-20 h-6 rounded-full" />
            </div>
            <div className="flex items-center space-x-3">
              <SkeletonBox className="w-32 h-10 rounded-md" />
              <SkeletonBox className="w-24 h-10 rounded-md" />
              <SkeletonBox className="w-20 h-10 rounded-md" />
            </div>
          </div>
        </div>
        
        {/* Transaction Summary Skeleton */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <SkeletonBox className="w-16 h-4 mb-2" />
                <SkeletonBox className="w-32 h-6 mb-1" />
                <SkeletonBox className="w-24 h-4 mb-1" />
                <SkeletonBox className="w-28 h-4" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items Table Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <SkeletonBox className="w-32 h-6" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Item', 'SKU', 'Quantity', 'Period', 'Status', 'Amount'].map((header) => (
                  <th key={header} className="px-6 py-3">
                    <SkeletonBox className="w-16 h-4" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div>
                      <SkeletonBox className="w-32 h-5 mb-1" />
                      <SkeletonBox className="w-24 h-4" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-20 h-4" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-8 h-4" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-24 h-4" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-20 h-6 rounded-full" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-16 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <SkeletonBox className="w-40 h-6" />
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <SkeletonBox className="w-16 h-4 mb-2 mx-auto" />
                <SkeletonBox className="w-20 h-6 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Return page loading skeleton
export const ReturnPageLoadingSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      
      {/* Header Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <SkeletonBox className="w-40 h-6" />
              <div className="h-6 w-px bg-gray-300" />
              <SkeletonBox className="w-56 h-8" />
              <SkeletonBox className="w-24 h-6 rounded-full" />
            </div>
            <SkeletonBox className="w-32 h-8 rounded-md" />
          </div>
        </div>
        
        {/* Customer Info Skeleton */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <SkeletonBox className="w-16 h-4 mb-2" />
                <SkeletonBox className="w-32 h-6 mb-1" />
                <SkeletonBox className="w-24 h-4 mb-1" />
                <SkeletonBox className="w-28 h-4" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Preview Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <SkeletonBox className="w-48 h-6" />
            <SkeletonBox className="w-24 h-4" />
          </div>
        </div>
      </div>

      {/* Return Items Table Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <SkeletonBox className="w-32 h-6" />
              <SkeletonBox className="w-40 h-4" />
            </div>
            <SkeletonBox className="w-48 h-8 rounded-md" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Item', 'SKU', 'Quantity', 'Period', 'Status', 'Action', 'Return Qty', 'Notes'].map((header) => (
                  <th key={header} className="px-6 py-3">
                    <SkeletonBox className="w-16 h-4" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <SkeletonBox className="w-4 h-4 rounded mr-4" />
                      <div>
                        <SkeletonBox className="w-32 h-5 mb-1" />
                        <SkeletonBox className="w-24 h-4" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-20 h-4" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-8 h-4" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-32 h-4" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-20 h-6 rounded-full" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-32 h-8 rounded-md" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-16 h-8 rounded-md" />
                  </td>
                  <td className="px-6 py-4">
                    <SkeletonBox className="w-full h-16 rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Area Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4">
          <SkeletonBox className="w-32 h-6 mb-4" />
          <SkeletonBox className="w-full h-20 rounded-md mb-6" />
          <div className="flex justify-end space-x-4">
            <SkeletonBox className="w-20 h-10 rounded-md" />
            <SkeletonBox className="w-32 h-10 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Return items table loading skeleton
export const ReturnItemsTableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <SkeletonBox className="w-32 h-6" />
          <SkeletonBox className="w-40 h-4" />
        </div>
        <SkeletonBox className="w-48 h-8 rounded-md" />
      </div>
    </div>
    
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: 8 }).map((_, i) => (
              <th key={i} className="px-6 py-3">
                <SkeletonBox className="w-16 h-4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: 3 }).map((_, i) => (
            <tr key={i}>
              <td className="px-6 py-4">
                <div className="flex items-center">
                  <SkeletonBox className="w-4 h-4 rounded mr-4" />
                  <div>
                    <SkeletonBox className="w-32 h-5 mb-1" />
                    <SkeletonBox className="w-24 h-4" />
                  </div>
                </div>
              </td>
              {Array.from({ length: 7 }).map((_, j) => (
                <td key={j} className="px-6 py-4">
                  <SkeletonBox className="w-20 h-4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    
    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <SkeletonBox className="w-48 h-4" />
        <SkeletonBox className="w-32 h-4" />
      </div>
    </div>
  </div>
);

// Loading spinner component with different sizes
export const LoadingSpinner = ({ 
  size = 'md', 
  color = 'blue-600',
  text = '' 
}: { 
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  text?: string;
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div 
        className={`animate-spin rounded-full border-b-2 border-${color} ${sizeClasses[size]}`}
      />
      {text && (
        <p className="text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  );
};

// Inline loading state for buttons
export const ButtonSpinner = ({ text = 'Loading...' }: { text?: string }) => (
  <div className="flex items-center justify-center">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
    {text}
  </div>
);