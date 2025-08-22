'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle, AlertCircle, RefreshCw, X } from 'lucide-react';

interface LocationErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: any;
  onTryAgain: () => void;
  onCancel: () => void;
}

export function LocationErrorDialog({
  open,
  onOpenChange,
  error,
  onTryAgain,
  onCancel,
}: LocationErrorDialogProps) {
  // Parse error details
  const getErrorDetails = () => {
    if (!error) return { title: 'An error occurred', message: 'Please try again later.' };

    // Handle different error formats
    if (typeof error === 'string') {
      return { title: 'Error', message: error };
    }

    if (error.response?.data) {
      const data = error.response.data;
      
      // FastAPI validation error format
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          // Validation errors array
          const fieldErrors = data.detail.map((err: any) => {
            const field = err.loc?.join('.') || 'Field';
            return `${field}: ${err.msg}`;
          });
          return {
            title: 'Validation Error',
            message: 'Please fix the following errors:',
            fieldErrors,
          };
        } else if (typeof data.detail === 'string') {
          return { title: 'Error', message: data.detail };
        }
      }

      // Generic error message
      if (data.message) {
        return { title: 'Error', message: data.message };
      }

      // Field-specific errors
      if (data.errors && typeof data.errors === 'object') {
        const fieldErrors = Object.entries(data.errors).map(
          ([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
        );
        return {
          title: 'Validation Error',
          message: 'Please fix the following errors:',
          fieldErrors,
        };
      }
    }

    // Network errors
    if (error.code === 'ERR_NETWORK') {
      return {
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
      };
    }

    // HTTP status errors
    if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          return { title: 'Bad Request', message: 'The request was invalid. Please check your input.' };
        case 401:
          return { title: 'Unauthorized', message: 'You are not authorized to perform this action.' };
        case 403:
          return { title: 'Forbidden', message: 'You do not have permission to create locations.' };
        case 404:
          return { title: 'Not Found', message: 'The requested resource was not found.' };
        case 409:
          return { title: 'Conflict', message: 'A location with this code already exists.' };
        case 500:
          return { title: 'Server Error', message: 'An internal server error occurred. Please try again later.' };
        default:
          return {
            title: `Error ${error.response.status}`,
            message: error.message || 'An unexpected error occurred.',
          };
      }
    }

    // Fallback
    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred. Please try again.',
    };
  };

  const errorDetails = getErrorDetails();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Failed to Create Location</DialogTitle>
              <DialogDescription className="mt-1">
                {errorDetails.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>{errorDetails.message}</p>
                {errorDetails.fieldErrors && (
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {errorDetails.fieldErrors.map((err: string, index: number) => (
                      <li key={index} className="text-sm">
                        {err}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Additional error details for debugging (only in development) */}
          {process.env.NODE_ENV === 'development' && error?.stack && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCancel();
            }}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onTryAgain();
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}