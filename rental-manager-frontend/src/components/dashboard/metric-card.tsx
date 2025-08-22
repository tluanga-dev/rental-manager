'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: ReactNode;
  trend?: ReactNode;
  trendColor?: string;
  description?: string;
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  icon,
  trend,
  trendColor,
  description,
  className,
  loading = false
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-6 w-6 bg-gray-200 rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className="text-gray-400">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {value}
        </div>
        
        <div className="flex items-center justify-between">
          {description && (
            <p className="text-xs text-gray-500 flex-1">
              {description}
            </p>
          )}
          
          {(change !== undefined || trend) && (
            <div className="flex items-center gap-1">
              {trend}
              {change !== undefined && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-1.5 py-0.5",
                    trendColor || (
                      change > 0 ? "text-green-600 border-green-200 bg-green-50" :
                      change < 0 ? "text-red-600 border-red-200 bg-red-50" :
                      "text-gray-600 border-gray-200 bg-gray-50"
                    )
                  )}
                >
                  {change > 0 && '+'}
                  {change.toFixed(1)}%
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}