'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, User, MessageSquare, Clock, Package, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { useRentalHistory } from '@/hooks/useRentalBlocking';
import type { EntityType } from '@/types/rental-blocking';

interface RentalStatusHistoryDialogProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RentalStatusHistoryDialog({
  entityType,
  entityId,
  entityName,
  isOpen,
  onClose
}: RentalStatusHistoryDialogProps) {
  const { history, isLoading, error } = useRentalHistory(entityType, entityId);

  const getEntityIcon = () => {
    return entityType === 'ITEM' ? Package : Wrench;
  };

  const getStatusBadge = (isBlocked: boolean, previousStatus?: boolean) => {
    if (previousStatus === undefined) {
      return (
        <Badge variant={isBlocked ? "destructive" : "success"}>
          Set to {isBlocked ? 'BLOCKED' : 'AVAILABLE'}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="text-xs">
        {previousStatus ? 'BLOCKED' : 'AVAILABLE'} → {isBlocked ? 'BLOCKED' : 'AVAILABLE'}
      </Badge>
    );
  };

  const EntityIcon = getEntityIcon();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <EntityIcon className="h-5 w-5 text-blue-600" />
            <div>
              <DialogTitle>Rental Status History</DialogTitle>
              <DialogDescription>
                History of rental status changes for &quot;{entityName}&quot;
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>Failed to load history</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
            </div>
          ) : !history?.entries || history.entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No status changes recorded</p>
              <p className="text-sm mt-1">This {entityType.toLowerCase()} has not had any rental status changes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.entries.map((entry, index) => (
                <div key={entry.id} className="relative">
                  {/* Timeline line */}
                  {index < history.entries.length - 1 && (
                    <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-gray-200" />
                  )}
                  
                  <div className="flex gap-4">
                    {/* Timeline dot */}
                    <div className={`
                      flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center
                      ${entry.is_blocked 
                        ? 'bg-red-50 border-red-200 text-red-600' 
                        : 'bg-green-50 border-green-200 text-green-600'
                      }
                    `}>
                      {entry.is_blocked ? '🔴' : '🟢'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(entry.is_blocked, entry.previous_status)}
                          {entry.entity_type === 'INVENTORY_UNIT' && entityType === 'ITEM' && (
                            <Badge variant="outline" className="text-xs">
                              Unit Level
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.changed_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* User info */}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-4 w-4" />
                          <span>
                            {entry.changed_by_full_name || entry.changed_by_username || `User ${entry.changed_by.slice(0, 8)}...`}
                          </span>
                        </div>

                        {/* Remarks */}
                        <div className="bg-gray-50 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700">{entry.remarks}</p>
                          </div>
                        </div>

                        {/* Entity info for mixed history */}
                        {entry.entity_display_name !== entityName && (
                          <div className="text-xs text-gray-500">
                            {entry.entity_display_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {index < history.entries.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}