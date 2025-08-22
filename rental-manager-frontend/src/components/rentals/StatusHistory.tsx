'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// ScrollArea component not available, using regular div with scrolling
import {
  Timeline,
  TimelineContent,
  TimelineDescription,
  TimelineIcon,
  TimelineItem,
  TimelinePoint,
  TimelineTitle,
} from '@/components/ui/timeline';
import {
  Activity,
  Package,
  Clock,
  User,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Info,
  Calendar,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { RentalStatusBadge } from '@/components/rentals';
import type { RentalStatus } from '@/types/rentals';

interface StatusHistoryProps {
  transactionId: string;
  className?: string;
  compact?: boolean;
}

interface TransactionEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  metadata?: {
    old_status?: RentalStatus;
    new_status?: RentalStatus;
    reason?: string;
    automated?: boolean;
    user_id?: string;
    user_name?: string;
  };
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

// Mock function to fetch transaction events - replace with actual API call
const fetchTransactionEvents = async (transactionId: string): Promise<TransactionEvent[]> => {
  // This would be replaced with actual API call
  // await transactionsApi.getEvents(transactionId);
  console.log('Fetching events for transaction:', transactionId);
  
  // Mock data for demonstration
  return [
    {
      id: '1',
      event_type: 'TRANSACTION_CREATED',
      event_data: {},
      metadata: { new_status: 'RESERVED', automated: false },
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by_name: 'John Smith',
    },
    {
      id: '2',
      event_type: 'STATUS_CHANGE',
      event_data: {},
      metadata: { 
        old_status: 'RESERVED', 
        new_status: 'CONFIRMED', 
        reason: 'Customer payment received',
        automated: false 
      },
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      created_by_name: 'Jane Doe',
    },
    {
      id: '3',
      event_type: 'STATUS_CHANGE',
      event_data: {},
      metadata: { 
        old_status: 'CONFIRMED', 
        new_status: 'PICKED_UP',
        reason: 'Items picked up by customer',
        automated: false 
      },
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_by_name: 'Mike Johnson',
    },
    {
      id: '4',
      event_type: 'STATUS_CHANGE',
      event_data: {},
      metadata: { 
        old_status: 'PICKED_UP', 
        new_status: 'ACTIVE',
        reason: 'Rental period started',
        automated: true 
      },
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      created_by_name: 'System',
    },
    {
      id: '5',
      event_type: 'RETURN_PROCESSED',
      event_data: {},
      metadata: { 
        old_status: 'ACTIVE', 
        new_status: 'PARTIAL_RETURN',
        reason: 'Partial return processed',
        automated: false 
      },
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      created_by_name: 'Sarah Wilson',
    },
  ];
};

const StatusHistory: React.FC<StatusHistoryProps> = ({ 
  transactionId, 
  className,
  compact = false 
}) => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ['transaction-events', transactionId],
    queryFn: () => fetchTransactionEvents(transactionId),
    refetchInterval: compact ? undefined : 30000, // Refresh every 30 seconds if not compact
  });

  const getEventIcon = (eventType: string, metadata?: TransactionEvent['metadata']) => {
    switch (eventType) {
      case 'TRANSACTION_CREATED':
        return Calendar;
      case 'STATUS_CHANGE':
        return metadata?.automated ? Clock : Activity;
      case 'RETURN_PROCESSED':
        return Package;
      case 'PAYMENT_RECEIVED':
        return CheckCircle;
      case 'ISSUE_REPORTED':
        return AlertCircle;
      default:
        return Info;
    }
  };

  const getEventTitle = (event: TransactionEvent): string => {
    switch (event.event_type) {
      case 'TRANSACTION_CREATED':
        return 'Transaction Created';
      case 'STATUS_CHANGE':
        return event.metadata?.automated ? 'Automated Status Update' : 'Status Changed';
      case 'RETURN_PROCESSED':
        return 'Return Processed';
      case 'PAYMENT_RECEIVED':
        return 'Payment Received';
      case 'ISSUE_REPORTED':
        return 'Issue Reported';
      default:
        return event.event_type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getEventDescription = (event: TransactionEvent): string => {
    if (event.metadata?.reason) {
      return event.metadata.reason;
    }
    
    switch (event.event_type) {
      case 'TRANSACTION_CREATED':
        return 'New rental transaction created';
      case 'STATUS_CHANGE':
        return 'Rental status updated';
      case 'RETURN_PROCESSED':
        return 'Items returned and processed';
      default:
        return 'Event processed';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading status history...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span className="ml-2">Failed to load status history</span>
        </CardContent>
      </Card>
    );
  }

  const statusEvents = events?.filter(e => 
    e.event_type === 'STATUS_CHANGE' || 
    e.event_type === 'RETURN_PROCESSED' ||
    e.event_type === 'TRANSACTION_CREATED'
  ) || [];

  if (compact) {
    // Compact view for smaller spaces
    return (
      <div className={className}>
        <div className="space-y-2">
          {statusEvents.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {event.metadata?.old_status && event.metadata?.new_status && (
                  <>
                    <RentalStatusBadge status={event.metadata.old_status} size="sm" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <RentalStatusBadge status={event.metadata.new_status} size="sm" />
                  </>
                )}
                {event.metadata?.new_status && !event.metadata?.old_status && (
                  <RentalStatusBadge status={event.metadata.new_status} size="sm" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getEventTitle(event)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.created_at))} ago
                </p>
              </div>
            </div>
          ))}
          {statusEvents.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{statusEvents.length - 3} more events
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] overflow-y-auto">
          <Timeline>
            {statusEvents.map((event) => {
              const Icon = getEventIcon(event.event_type, event.metadata);
              const isAutomated = event.metadata?.automated;
              
              return (
                <TimelineItem key={event.id}>
                  <TimelinePoint>
                    <TimelineIcon className={isAutomated ? 'text-blue-600' : 'text-gray-600'}>
                      <Icon className="h-4 w-4" />
                    </TimelineIcon>
                  </TimelinePoint>
                  <TimelineContent>
                    <TimelineTitle className="flex items-center gap-2">
                      {getEventTitle(event)}
                      {isAutomated && (
                        <Badge variant="outline" className="text-xs">
                          Automated
                        </Badge>
                      )}
                    </TimelineTitle>
                    <TimelineDescription>
                      <div className="space-y-2">
                        {/* Status Change Display */}
                        {event.metadata?.old_status && event.metadata?.new_status && (
                          <div className="flex items-center gap-2">
                            <RentalStatusBadge status={event.metadata.old_status} size="sm" />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <RentalStatusBadge status={event.metadata.new_status} size="sm" />
                          </div>
                        )}
                        
                        {/* New Status Only */}
                        {event.metadata?.new_status && !event.metadata?.old_status && (
                          <RentalStatusBadge status={event.metadata.new_status} size="sm" />
                        )}
                        
                        {/* Event Description */}
                        <p className="text-sm text-muted-foreground">
                          {getEventDescription(event)}
                        </p>
                        
                        {/* Event Metadata */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                          {event.created_by_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.created_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </TimelineDescription>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
          
          {statusEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No status changes recorded yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusHistory;