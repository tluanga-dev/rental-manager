'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  AlertTriangle, 
  IndianRupee, 
  MapPin, 
  TrendingUp,
  Package
} from 'lucide-react';
import type { DueTodaySummary } from '@/types/rentals';

interface DueTodayStatsProps {
  summary: DueTodaySummary;
  isLoading?: boolean;
  className?: string;
}

export function DueTodayStats({ summary, isLoading = false, className = '' }: DueTodayStatsProps) {
  if (isLoading) {
    return <DueTodayStatsLoading className={className} />;
  }

  const stats = [
    {
      title: 'Total Due Today',
      value: summary.total_rentals.toString(),
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Overdue Rentals',
      value: summary.overdue_count.toString(),
      icon: AlertTriangle,
      color: summary.overdue_count > 0 ? 'text-red-600' : 'text-gray-600',
      bgColor: summary.overdue_count > 0 ? 'bg-red-50' : 'bg-gray-50',
      borderColor: summary.overdue_count > 0 ? 'border-red-200' : 'border-gray-200',
    },
    {
      title: 'Total Value',
      value: `₹${summary.total_value.toLocaleString()}`,
      icon: IndianRupee,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: 'Locations',
      value: summary.locations.length.toString(),
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className={`border-2 ${stat.borderColor} hover:shadow-md transition-shadow`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Location Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              Location Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.locations.length > 0 ? (
              <div className="space-y-3">
                {summary.locations.map((location) => (
                  <div
                    key={location.location_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {location.location_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {location.rental_count} rental{location.rental_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ₹{location.total_value.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {((location.rental_count / summary.total_rentals) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No location data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(summary.status_breakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(summary.status_breakdown).map(([status, count]) => {
                  const percentage = ((count / summary.total_rentals) * 100).toFixed(1);
                  const statusColor = getStatusColor(status);
                  
                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${statusColor.bg}`} />
                        <div>
                          <p className="font-medium text-gray-900 capitalize">
                            {status.toLowerCase().replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {count} rental{count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={`${statusColor.text} ${statusColor.border}`}>
                          {percentage}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No status data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Footer */}
      {summary.total_rentals > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {summary.total_rentals} rental{summary.total_rentals !== 1 ? 's' : ''} due today
                  </p>
                  <p className="text-sm text-gray-600">
                    Total value: ₹{summary.total_value.toLocaleString()}
                    {summary.overdue_count > 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        • {summary.overdue_count} overdue
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {summary.overdue_count > 0 && (
                <Badge variant="destructive" className="text-sm">
                  Action Required
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DueTodayStatsLoading({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Stats Grid Loading */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Breakdown Loading */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return {
        bg: 'bg-green-500',
        text: 'text-green-700',
        border: 'border-green-200',
      };
    case 'CONFIRMED':
      return {
        bg: 'bg-blue-500',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'IN_PROGRESS':
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
      };
    case 'OVERDUE':
      return {
        bg: 'bg-red-500',
        text: 'text-red-700',
        border: 'border-red-200',
      };
    default:
      return {
        bg: 'bg-gray-500',
        text: 'text-gray-700',
        border: 'border-gray-200',
      };
  }
}

export default DueTodayStats;