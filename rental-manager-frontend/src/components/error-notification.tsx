'use client';

import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface ErrorDetails {
  code?: string;
  message: string;
  status_code?: number;
  endpoint?: string;
  method?: string;
  request_id?: string;
  timestamp?: string;
  details?: Record<string, any>;
  suggestions?: string[];
  stack_trace?: string;
}

interface ErrorNotificationProps {
  error: ErrorDetails;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorNotification({ 
  error, 
  onRetry, 
  onDismiss, 
  className = '' 
}: ErrorNotificationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyErrorDetails = async () => {
    const errorText = JSON.stringify(error, null, 2);
    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const getStatusCodeColor = (statusCode?: number) => {
    if (!statusCode) return 'bg-gray-500';
    if (statusCode >= 500) return 'bg-red-500';
    if (statusCode >= 400) return 'bg-orange-500';
    if (statusCode >= 300) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatEndpoint = (method?: string, endpoint?: string) => {
    if (!endpoint) return null;
    return `${method?.toUpperCase() || 'GET'} ${endpoint}`;
  };

  return (
    <Alert variant="destructive" className={`space-y-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <AlertTitle className="text-base font-semibold">
              API Error
              {error.status_code && (
                <Badge 
                  variant="secondary" 
                  className={`ml-2 text-white ${getStatusCodeColor(error.status_code)}`}
                >
                  {error.status_code}
                </Badge>
              )}
            </AlertTitle>
            <div className="flex items-center space-x-2">
              {onRetry && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onRetry}
                  className="h-8"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onDismiss}
                  className="h-8"
                >
                  ×
                </Button>
              )}
            </div>
          </div>

          <AlertDescription className="mt-2 space-y-3">
            {/* Error Message */}
            <div>
              <p className="font-medium text-sm">{error.message}</p>
              {formatEndpoint(error.method, error.endpoint) && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {formatEndpoint(error.method, error.endpoint)}
                </p>
              )}
            </div>

            {/* Suggestions */}
            {error.suggestions && error.suggestions.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  💡 Suggestions:
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  {error.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-500 mr-1">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expandable Details */}
            {(error.details || error.request_id || error.timestamp || error.stack_trace) && (
              <div className="border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-7 px-2 text-xs"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show Details
                    </>
                  )}
                </Button>

                {isExpanded && (
                  <div className="mt-3 space-y-3 text-xs">
                    {/* Request Info */}
                    {(error.request_id || error.timestamp) && (
                      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border">
                        <p className="font-medium mb-1">Request Information:</p>
                        {error.request_id && (
                          <p><span className="font-mono">Request ID:</span> {error.request_id}</p>
                        )}
                        {error.timestamp && (
                          <p><span className="font-mono">Timestamp:</span> {error.timestamp}</p>
                        )}
                      </div>
                    )}

                    {/* Error Details */}
                    {error.details && Object.keys(error.details).length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border">
                        <p className="font-medium mb-1">Error Details:</p>
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(error.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Stack Trace */}
                    {error.stack_trace && (
                      <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border">
                        <p className="font-medium mb-1">Stack Trace:</p>
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                          {error.stack_trace}
                        </pre>
                      </div>
                    )}

                    {/* Copy Button */}
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyErrorDetails}
                        className="h-7 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {copied ? 'Copied!' : 'Copy Error Details'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

// Hook for displaying error notifications
export function useErrorNotification() {
  const [errors, setErrors] = useState<Array<ErrorDetails & { id: string }>>([]);

  const addError = (error: ErrorDetails) => {
    const errorWithId = {
      ...error,
      id: Date.now().toString()
    };
    setErrors(prev => [...prev, errorWithId]);
  };

  const removeError = (id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  };

  const clearAllErrors = () => {
    setErrors([]);
  };

  return {
    errors,
    addError,
    removeError,
    clearAllErrors
  };
}

// Global error notification container
export function ErrorNotificationContainer() {
  const { errors, removeError } = useErrorNotification();

  if (errors.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {errors.map((error) => (
        <ErrorNotification
          key={error.id}
          error={error}
          onDismiss={() => removeError(error.id)}
          className="shadow-lg"
        />
      ))}
    </div>
  );
}