'use client';

import React from 'react';
import { AlertTriangle, X, Copy, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

export interface ErrorDetail {
  field?: string;
  message: string;
  type?: string;
  location?: string[];
}

export interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  error?: any;
  httpStatus?: number;
  requestId?: string;
  timestamp?: string;
  endpoint?: string;
  retryAction?: () => void;
  onClose?: () => void;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title = "Error Occurred",
  error,
  httpStatus,
  requestId,
  timestamp,
  endpoint,
  retryAction,
  onClose
}: ErrorDialogProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Extract error information
  const errorMessage = error?.response?.data?.detail || error?.message || 'An unexpected error occurred';
  const validationErrors = error?.response?.data?.detail;
  const isValidationError = httpStatus === 422 && Array.isArray(validationErrors);
  const errorType = getErrorType(httpStatus);
  const userFriendlyMessage = getUserFriendlyMessage(httpStatus, errorMessage);

  // Parse validation errors
  const parsedValidationErrors: ErrorDetail[] = isValidationError 
    ? validationErrors.map((err: any) => ({
        field: err.loc?.join('.') || 'unknown',
        message: err.msg || 'Invalid value',
        type: err.type || 'validation_error',
        location: err.loc || []
      }))
    : [];

  const handleCopyDetails = () => {
    const details = {
      timestamp: timestamp || new Date().toISOString(),
      endpoint,
      httpStatus,
      requestId,
      error: {
        message: errorMessage,
        response: error?.response?.data,
        stack: error?.stack
      }
    };
    
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
  };

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${getErrorSeverityStyle(httpStatus)}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                {title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getErrorBadgeVariant(httpStatus)}>
                  {errorType}
                </Badge>
                {httpStatus && (
                  <Badge variant="outline">
                    HTTP {httpStatus}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <DialogDescription className="text-base leading-relaxed">
            {userFriendlyMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation Errors */}
          {isValidationError && parsedValidationErrors.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-900">Validation Issues:</h4>
              <div className="space-y-2">
                {parsedValidationErrors.map((error, index) => (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-red-800">
                          {error.field}
                        </div>
                        <div className="text-sm text-red-700 mt-1">
                          {error.message}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {error.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Details Collapsible */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="text-sm">View Error Details</span>
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3">
              <div className="p-4 bg-gray-50 border rounded-lg space-y-3">
                {endpoint && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Endpoint</div>
                    <div className="text-sm font-mono text-gray-800 mt-1">{endpoint}</div>
                  </div>
                )}
                
                {requestId && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Request ID</div>
                    <div className="text-sm font-mono text-gray-800 mt-1">{requestId}</div>
                  </div>
                )}
                
                {timestamp && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Timestamp</div>
                    <div className="text-sm text-gray-800 mt-1">{new Date(timestamp).toLocaleString()}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Error Message</div>
                  <div className="text-sm text-gray-800 mt-1 font-mono bg-white p-2 border rounded">
                    {errorMessage}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Technical Details Collapsible */}
          <Collapsible open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="text-sm">Technical Details</span>
                {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3">
              <div className="p-4 bg-gray-50 border rounded-lg">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify({
                    error: {
                      message: error?.message,
                      response: error?.response?.data,
                      status: error?.response?.status,
                      statusText: error?.response?.statusText,
                      headers: error?.response?.headers
                    }
                  }, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <div className="flex gap-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDetails}
                className="flex-1 sm:flex-none"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Details
              </Button>
              
              {requestId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/admin/requests/${requestId}`, '_blank')}
                  className="flex-1 sm:flex-none"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Admin
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              {retryAction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retryAction}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              
              <Button
                onClick={handleClose}
                className="flex-1 sm:flex-none"
              >
                Close
              </Button>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            If this problem persists, please copy the error details and contact support.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions
function getErrorType(httpStatus?: number): string {
  if (!httpStatus) return 'Unknown Error';
  
  if (httpStatus >= 400 && httpStatus < 500) {
    switch (httpStatus) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 409: return 'Conflict';
      case 422: return 'Validation Error';
      case 429: return 'Rate Limited';
      default: return 'Client Error';
    }
  }
  
  if (httpStatus >= 500) {
    switch (httpStatus) {
      case 500: return 'Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      case 504: return 'Gateway Timeout';
      default: return 'Server Error';
    }
  }
  
  return 'Unknown Error';
}

function getUserFriendlyMessage(httpStatus?: number, errorMessage?: string): string {
  if (!httpStatus) return errorMessage || 'An unexpected error occurred. Please try again.';
  
  switch (httpStatus) {
    case 400:
      return 'The request contains invalid data. Please check your input and try again.';
    case 401:
      return 'Your session has expired. Please log in again to continue.';
    case 403:
      return 'You do not have permission to perform this action. Please contact your administrator.';
    case 404:
      return 'The requested resource could not be found. It may have been moved or deleted.';
    case 409:
      return 'This operation conflicts with existing data. Please check for duplicates or related records.';
    case 422:
      return 'The submitted data contains validation errors. Please review the highlighted fields below.';
    case 429:
      return 'You are making requests too quickly. Please wait a moment and try again.';
    case 500:
      return 'A server error occurred. Our team has been notified. Please try again later.';
    case 502:
      return 'The server is temporarily unavailable. Please try again in a few minutes.';
    case 503:
      return 'The service is temporarily unavailable for maintenance. Please try again later.';
    case 504:
      return 'The request timed out. Please check your connection and try again.';
    default:
      return errorMessage || 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }
}

function getErrorSeverityStyle(httpStatus?: number): string {
  if (!httpStatus) return 'bg-gray-100 text-gray-600';
  
  if (httpStatus >= 500) return 'bg-red-100 text-red-600';
  if (httpStatus === 422) return 'bg-yellow-100 text-yellow-600';
  if (httpStatus >= 400) return 'bg-orange-100 text-orange-600';
  
  return 'bg-gray-100 text-gray-600';
}

function getErrorBadgeVariant(httpStatus?: number): "default" | "secondary" | "destructive" | "outline" {
  if (!httpStatus) return 'secondary';
  
  if (httpStatus >= 500) return 'destructive';
  if (httpStatus === 422) return 'secondary';
  if (httpStatus >= 400) return 'outline';
  
  return 'default';
}