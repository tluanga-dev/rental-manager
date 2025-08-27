'use client';

import React, { useState } from 'react';
import { AlertTriangle, Copy, Eye, X, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ErrorDetails, ConflictErrorData, ErrorAction } from '@/types/error';
import { cn } from '@/lib/utils';

interface ConflictErrorDialogProps {
  open: boolean;
  onClose: () => void;
  errorDetails?: ErrorDetails | null;
  conflictData?: ConflictErrorData | null;
  onAction?: (action: string, data?: any) => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ConflictErrorDialog({
  open,
  onClose,
  errorDetails,
  conflictData,
  onAction,
  onRetry,
  isRetrying = false
}: ConflictErrorDialogProps) {
  // Early return if no error details
  if (!open || !errorDetails) {
    return null;
  }
  const [selectedAlternative, setSelectedAlternative] = useState<string>('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const handleActionClick = (action: ErrorAction) => {
    if (action.action === 'suggest_alternatives' && selectedAlternative) {
      onAction?.(action.action, { suggestedName: selectedAlternative });
    } else if (action.action === 'view_existing') {
      onAction?.(action.action, { resourceId: conflictData?.conflictingResource.id });
    } else if (action.action === 'retry') {
      onRetry?.();
    } else if (action.action === 'cancel') {
      onClose();
    } else {
      onAction?.(action.action, action.data);
    }
  };

  const handleCopyError = () => {
    const errorInfo = {
      title: errorDetails?.title || 'Unknown Error',
      message: errorDetails?.message || 'An error occurred',
      details: errorDetails?.details,
      technical: errorDetails?.technical,
      timestamp: new Date().toISOString()
    };
    
    navigator.clipboard?.writeText(JSON.stringify(errorInfo, null, 2));
  };

  const getSeverityColor = () => {
    const severity = errorDetails?.severity || 'LOW';
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-full',
              getSeverityColor()
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {errorDetails?.title || 'Error'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {errorDetails?.type ? errorDetails.type.replace('_', ' ').toLowerCase() : 'unknown error'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Message */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {errorDetails?.message || 'An error occurred while processing your request.'}
            </p>
            {errorDetails?.details && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                {errorDetails?.details}
              </p>
            )}
          </div>

          {/* Conflict Information */}
          {conflictData && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">
                Existing Item Details
              </h4>
              <div className="space-y-1 text-sm text-amber-700">
                <p><strong>Name:</strong> {conflictData.conflictingResource.name}</p>
                {conflictData.conflictingResource.type && (
                  <p><strong>Type:</strong> {conflictData.conflictingResource.type}</p>
                )}
                {conflictData.conflictingResource.createdAt && (
                  <p><strong>Created:</strong> {new Date(conflictData.conflictingResource.createdAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          )}

          {/* Alternative Suggestions */}
          {conflictData?.suggestedAlternatives && conflictData.suggestedAlternatives.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Suggested Alternative Names:</h4>
              <div className="grid grid-cols-1 gap-2">
                {conflictData.suggestedAlternatives.map((alternative, index) => (
                  <label
                    key={index}
                    className={cn(
                      'flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all',
                      selectedAlternative === alternative
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="alternative"
                      value={alternative}
                      checked={selectedAlternative === alternative}
                      onChange={(e) => setSelectedAlternative(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-mono">{alternative}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {errorDetails?.suggestions && errorDetails.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Suggestions:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {errorDetails?.suggestions?.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Details (Collapsible) */}
          {errorDetails?.technical && (
            <div className="border-t pt-4">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{showTechnicalDetails ? 'Hide' : 'Show'} Technical Details</span>
                <X 
                  className={cn(
                    'h-3 w-3 transition-transform',
                    showTechnicalDetails ? 'rotate-45' : ''
                  )}
                />
              </button>
              
              {showTechnicalDetails && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <div className="space-y-2 text-xs font-mono">
                    {errorDetails?.technical?.statusCode && (
                      <div><strong>Status Code:</strong> {errorDetails.technical.statusCode}</div>
                    )}
                    {errorDetails?.technical?.requestId && (
                      <div><strong>Request ID:</strong> {errorDetails.technical.requestId}</div>
                    )}
                    {errorDetails?.technical?.endpoint && (
                      <div><strong>Endpoint:</strong> {errorDetails.technical.endpoint}</div>
                    )}
                    {errorDetails?.technical?.timestamp && (
                      <div><strong>Timestamp:</strong> {errorDetails.technical.timestamp}</div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleCopyError}
                  >
                    <Copy className="h-3 w-3" />
                    Copy Error Info
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {/* Action Buttons */}
          {errorDetails?.actions && errorDetails?.actions?.map((action, index) => {
            const isDisabled = action.action === 'suggest_alternatives' && !selectedAlternative;
            const isRetryButton = action.action === 'retry';
            
            return (
              <Button
                key={index}
                variant={action.variant || 'default'}
                onClick={() => handleActionClick(action)}
                disabled={isDisabled || (isRetryButton && isRetrying)}
                className="min-w-[100px]"
              >
                {isRetryButton && isRetrying && (
                  <RotateCcw className="h-4 w-4 animate-spin" />
                )}
                {action.action === 'view_existing' && <Eye className="h-4 w-4" />}
                {action.label}
              </Button>
            );
          })}

          {/* Default Cancel if no actions provided */}
          {(!errorDetails?.actions || errorDetails?.actions?.length === 0) && (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}