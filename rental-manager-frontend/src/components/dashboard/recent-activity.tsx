'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  UserPlus, 
  ShoppingCart, 
  RotateCcw, 
  DollarSign,
  Clock,
  RefreshCw,
  Eye,
  ArrowRight,
  Activity
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import { dashboardApi } from '@/services/api/dashboard';

interface ActivityItem {
  id: string;
  type: 'rental_created' | 'rental_returned' | 'purchase_completed' | 'customer_added' | 'payment_received';
  title: string;
  description: string;
  amount?: number;
  customer?: string;
  timestamp: string;
  status?: 'completed' | 'pending' | 'processing';
  metadata?: Record<string, any>;
}

interface RecentActivityProps {
  limit?: number;
  refreshInterval?: number;
  showViewAll?: boolean;
}

export function RecentActivity({ 
  limit = 10, 
  refreshInterval = 30000,
  showViewAll = true 
}: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = async () => {
    setRefreshing(true);
    try {
      // Fetch real data from the API
      const response = await dashboardApi.getRecentActivity(limit);
      if (response.success && response.data) {
        // Ensure response.data is an array before setting
        const activitiesData = Array.isArray(response.data) ? response.data : [];
        setActivities(activitiesData);
      } else {
        console.error('Failed to fetch recent activities: No data returned or invalid response format');
        setActivities([]);
      }
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      // Set empty array on error to show "no activity" state
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    
    // Set up auto-refresh if interval is provided
    if (refreshInterval > 0) {
      const interval = setInterval(fetchActivities, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [limit, refreshInterval]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'rental_created':
        return <Package className="w-4 h-4" />;
      case 'rental_returned':
        return <RotateCcw className="w-4 h-4" />;
      case 'purchase_completed':
        return <ShoppingCart className="w-4 h-4" />;
      case 'customer_added':
        return <UserPlus className="w-4 h-4" />;
      case 'payment_received':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'rental_created':
        return 'text-blue-600 bg-blue-100';
      case 'rental_returned':
        return 'text-green-600 bg-green-100';
      case 'purchase_completed':
        return 'text-purple-600 bg-purple-100';
      case 'customer_added':
        return 'text-indigo-600 bg-indigo-100';
      case 'payment_received':
        return 'text-emerald-600 bg-emerald-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Completed</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Processing</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Pending</Badge>;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return activityTime.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="w-20 h-6 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium mb-1">No recent activity</p>
          <p className="text-sm">Activity will appear here as it happens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">Recent Activity</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchActivities}
          disabled={refreshing}
          className="h-8 px-2"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Activity List */}
      <div className="space-y-1">
        {Array.isArray(activities) && activities.map((activity, index) => (
          <div
            key={activity.id}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-gray-50",
              index < 3 && "bg-blue-50/30" // Highlight most recent items
            )}
          >
            {/* Activity Icon */}
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              getActivityColor(activity.type)
            )}>
              {getActivityIcon(activity.type)}
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.title}
                </p>
                {activity.status && getStatusBadge(activity.status)}
              </div>
              <p className="text-xs text-gray-600 truncate">
                {activity.description}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(activity.timestamp)}
                </div>
                {activity.customer && (
                  <span className="text-xs text-gray-500">
                    • {activity.customer}
                  </span>
                )}
              </div>
            </div>

            {/* Amount & Action */}
            <div className="flex items-center gap-3">
              {activity.amount && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrencySync(activity.amount)}
                  </p>
                </div>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* View All Button */}
      {showViewAll && Array.isArray(activities) && activities.length >= limit && (
        <div className="pt-4 border-t">
          <Button variant="outline" className="w-full" size="sm">
            <span>View All Activity</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}