import { AxiosError } from 'axios';
import { 
  ErrorType, 
  ErrorSeverity, 
  ErrorDetails, 
  ApiErrorResponse,
  ConflictErrorData,
  ErrorAction 
} from '@/types/error';

export class ErrorParser {
  static parseAxiosError(error: AxiosError): ErrorDetails {
    const response = error.response;
    const statusCode = response?.status;
    const responseData = response?.data as ApiErrorResponse;

    // Extract basic error information
    const title = this.getErrorTitle(statusCode, responseData);
    const message = this.getErrorMessage(statusCode, responseData);
    const type = this.getErrorType(statusCode, responseData);
    const severity = this.getErrorSeverity(statusCode, type);

    // Build technical details
    const technical = {
      statusCode,
      requestId: response?.headers?.['x-request-id'],
      timestamp: new Date().toISOString(),
      endpoint: error.config?.url
    };

    // Generate suggestions and actions based on error type
    const { suggestions, actions } = this.getErrorGuidance(type, responseData, statusCode);

    return {
      type,
      severity,
      title,
      message,
      details: responseData?.detail || responseData?.message,
      suggestions,
      actions,
      technical
    };
  }

  static parseConflictError(error: AxiosError): ConflictErrorData | null {
    if (error.response?.status !== 409) return null;

    const responseData = error.response.data as ApiErrorResponse;
    const detail = responseData?.detail || responseData?.message || '';

    // Extract resource name from error message
    const nameMatch = detail.match(/name '([^']+)' already exists/);
    const resourceName = nameMatch ? nameMatch[1] : 'Unknown';

    // Generate alternative suggestions
    const suggestedAlternatives = this.generateAlternativeNames(resourceName);

    return {
      conflictingResource: {
        name: resourceName,
        type: 'Item'
      },
      suggestedAlternatives,
      allowOverwrite: false // Could be configurable based on user permissions
    };
  }

  private static getErrorTitle(statusCode?: number, responseData?: ApiErrorResponse): string {
    if (statusCode === 409) {
      return 'Item Already Exists';
    }

    const statusTitles: Record<number, string> = {
      400: 'Invalid Request',
      401: 'Authentication Required',
      403: 'Access Denied',
      404: 'Not Found',
      422: 'Validation Error',
      429: 'Too Many Requests',
      500: 'Server Error',
      502: 'Service Unavailable',
      503: 'Service Unavailable',
      504: 'Request Timeout'
    };

    return statusCode ? statusTitles[statusCode] || 'Error' : 'Network Error';
  }

  private static getErrorMessage(statusCode?: number, responseData?: ApiErrorResponse): string {
    // Use API provided message if available and user-friendly
    if (responseData?.message && !responseData.message.includes('internal') && !responseData.message.includes('stack')) {
      return responseData.message;
    }

    if (statusCode === 409) {
      const detail = responseData?.detail || '';
      const nameMatch = detail.match(/name '([^']+)' already exists/);
      if (nameMatch) {
        return `An item named "${nameMatch[1]}" already exists. Please choose a different name.`;
      }
      return 'This item already exists. Please choose a different name or modify the existing item.';
    }

    const statusMessages: Record<number, string> = {
      400: 'The request contains invalid data. Please check your input and try again.',
      401: 'You need to sign in to perform this action.',
      403: 'You don\'t have permission to perform this action.',
      404: 'The requested resource could not be found.',
      422: 'Please correct the highlighted errors and try again.',
      429: 'Too many requests. Please wait a moment before trying again.',
      500: 'An unexpected error occurred. Please try again later.',
      502: 'The service is temporarily unavailable. Please try again later.',
      503: 'The service is temporarily unavailable. Please try again later.',
      504: 'The request timed out. Please try again.'
    };

    return statusCode ? statusMessages[statusCode] || 'An error occurred while processing your request.' 
                      : 'Network connection failed. Please check your connection and try again.';
  }

  private static getErrorType(statusCode?: number, responseData?: ApiErrorResponse): ErrorType {
    if (!statusCode) return ErrorType.NETWORK;

    if (statusCode === 409) {
      // Check if it's a duplicate resource
      const detail = responseData?.detail || responseData?.message || '';
      if (detail.includes('already exists')) {
        return ErrorType.DUPLICATE_RESOURCE;
      }
      return ErrorType.CONFLICT;
    }

    const typeMap: Record<number, ErrorType> = {
      400: ErrorType.VALIDATION,
      401: ErrorType.UNAUTHORIZED,
      403: ErrorType.FORBIDDEN,
      404: ErrorType.NOT_FOUND,
      422: ErrorType.VALIDATION,
      429: ErrorType.CLIENT_ERROR,
      500: ErrorType.INTERNAL_SERVER,
      502: ErrorType.INTERNAL_SERVER,
      503: ErrorType.INTERNAL_SERVER,
      504: ErrorType.TIMEOUT
    };

    return typeMap[statusCode] || ErrorType.UNKNOWN;
  }

  private static getErrorSeverity(statusCode?: number, type?: ErrorType): ErrorSeverity {
    if (type === ErrorType.DUPLICATE_RESOURCE || type === ErrorType.VALIDATION) {
      return ErrorSeverity.LOW;
    }

    if (!statusCode) return ErrorSeverity.HIGH;

    if (statusCode >= 500) return ErrorSeverity.CRITICAL;
    if (statusCode >= 400) return ErrorSeverity.MEDIUM;
    
    return ErrorSeverity.LOW;
  }

  private static getErrorGuidance(
    type: ErrorType, 
    responseData?: ApiErrorResponse, 
    statusCode?: number
  ): { suggestions: string[], actions: ErrorAction[] } {
    
    if (type === ErrorType.DUPLICATE_RESOURCE) {
      return {
        suggestions: [
          'Choose a different name for your item',
          'Check if you intended to update the existing item instead',
          'View the existing item to see if it meets your needs'
        ],
        actions: [
          {
            label: 'Try Different Name',
            action: 'suggest_alternatives',
            variant: 'default'
          },
          {
            label: 'View Existing Item',
            action: 'view_existing',
            variant: 'outline'
          },
          {
            label: 'Cancel',
            action: 'cancel',
            variant: 'secondary'
          }
        ]
      };
    }

    if (type === ErrorType.VALIDATION) {
      return {
        suggestions: [
          'Review the highlighted fields for errors',
          'Ensure all required fields are filled',
          'Check that values meet the specified requirements'
        ],
        actions: [
          {
            label: 'Review Form',
            action: 'review_form',
            variant: 'default'
          }
        ]
      };
    }

    if (type === ErrorType.NETWORK || type === ErrorType.TIMEOUT) {
      return {
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if the problem continues'
        ],
        actions: [
          {
            label: 'Try Again',
            action: 'retry',
            variant: 'default'
          },
          {
            label: 'Cancel',
            action: 'cancel',
            variant: 'secondary'
          }
        ]
      };
    }

    // Default guidance for other errors
    return {
      suggestions: [
        'Try refreshing the page',
        'Wait a moment and try again',
        'Contact support if the issue persists'
      ],
      actions: [
        {
          label: 'Try Again',
          action: 'retry',
          variant: 'default'
        },
        {
          label: 'Cancel',
          action: 'cancel',
          variant: 'secondary'
        }
      ]
    };
  }

  private static generateAlternativeNames(originalName: string): string[] {
    const alternatives: string[] = [];
    
    // Add timestamp-based alternatives
    const timestamp = new Date().getTime();
    alternatives.push(`${originalName} (${timestamp})`);
    
    // Add numbered alternatives
    for (let i = 1; i <= 3; i++) {
      alternatives.push(`${originalName} ${i}`);
    }
    
    // Add descriptive alternatives
    alternatives.push(`${originalName} - Copy`);
    alternatives.push(`${originalName} - New`);
    
    return alternatives.slice(0, 5); // Limit to 5 suggestions
  }

  static isRetryableError(error: AxiosError): boolean {
    const statusCode = error.response?.status;
    
    // Network errors are retryable
    if (!statusCode) return true;
    
    // Server errors and rate limiting are retryable
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(statusCode);
  }

  static getRetryDelay(attemptNumber: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
    const jitter = Math.random() * 0.1 * delay;
    
    return delay + jitter;
  }
}