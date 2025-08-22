'use client';

// Enhanced error messaging and recovery components
import React, { ReactNode } from 'react';
import { 
  AlertTriangle as ExclamationTriangleIcon, 
  AlertCircle as ExclamationCircleIcon,
  Info as InformationCircleIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  RotateCcw as ArrowPathIcon
} from 'lucide-react';
import { AnimatedButton, FadeIn } from './AnimationComponents';

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'success';

// Error types with specific handling
export type ErrorType = 
  | 'network_error'
  | 'validation_error' 
  | 'permission_error'
  | 'not_found_error'
  | 'server_error'
  | 'timeout_error'
  | 'generic_error';

interface ErrorInfo {
  type: ErrorType;
  message: string;
  details?: string;
  code?: string | number;
  timestamp?: Date;
}

// Enhanced error alert component
export const ErrorAlert = ({
  error,
  severity = 'error',
  dismissible = true,
  onDismiss,
  onRetry,
  className = ''
}: {
  error: ErrorInfo | string;
  severity?: ErrorSeverity;
  dismissible?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}) => {
  const errorInfo = typeof error === 'string' 
    ? { type: 'generic_error' as ErrorType, message: error }
    : error;

  const severityConfig = {
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-400',
      icon: InformationCircleIcon
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-400',
      icon: ExclamationTriangleIcon
    },
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-400',
      icon: XCircleIcon
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-400',
      icon: CheckCircleIcon
    }
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  const getErrorTitle = (type: ErrorType): string => {
    const titles = {
      network_error: 'Connection Error',
      validation_error: 'Validation Error',
      permission_error: 'Permission Denied',
      not_found_error: 'Not Found',
      server_error: 'Server Error',
      timeout_error: 'Request Timeout',
      generic_error: 'Error'
    };
    return titles[type];
  };

  const getSuggestedAction = (type: ErrorType): string => {
    const actions = {
      network_error: 'Please check your internet connection and try again.',
      validation_error: 'Please check your input and correct any errors.',
      permission_error: 'You don\'t have permission to perform this action.',
      not_found_error: 'The requested resource could not be found.',
      server_error: 'A server error occurred. Please try again later.',
      timeout_error: 'The request timed out. Please try again.',
      generic_error: 'An unexpected error occurred.'
    };
    return actions[type];
  };

  return (
    <FadeIn>
      <div className={`rounded-md border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${config.textColor}`}>
              {getErrorTitle(errorInfo.type)}
            </h3>
            <div className={`mt-2 text-sm ${config.textColor}`}>
              <p>{errorInfo.message}</p>
              {errorInfo.details && (
                <p className="mt-1 text-xs opacity-75">{errorInfo.details}</p>
              )}
              <p className="mt-1 text-xs">{getSuggestedAction(errorInfo.type)}</p>
              {errorInfo.code && (
                <p className="mt-1 text-xs font-mono opacity-50">Error Code: {errorInfo.code}</p>
              )}
            </div>
            {(onRetry || dismissible) && (
              <div className="mt-4 flex space-x-2">
                {onRetry && (
                  <AnimatedButton
                    size="sm"
                    variant="secondary"
                    onClick={onRetry}
                    className="text-xs"
                  >
                    <ArrowPathIcon className="w-3 h-3 mr-1" />
                    Try Again
                  </AnimatedButton>
                )}
                {dismissible && onDismiss && (
                  <button
                    onClick={onDismiss}
                    className={`text-xs underline hover:no-underline ${config.textColor} opacity-75`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </div>
          {dismissible && onDismiss && (
            <div className="ml-auto pl-3">
              <button
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 ${config.textColor}`}
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
};

// Error boundary component
export class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}

// Error fallback component
export const ErrorFallback = ({
  error,
  onRetry,
  title = 'Something went wrong',
  className = ''
}: {
  error?: Error;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) => {
  return (
    <div className={`min-h-96 flex items-center justify-center ${className}`}>
      <div className="text-center max-w-md mx-auto p-6">
        <ExclamationCircleIcon className="mx-auto h-16 w-16 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        {error && (
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
        )}
        <p className="text-sm text-gray-500 mb-6">
          We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.
        </p>
        <div className="flex justify-center space-x-3">
          {onRetry && (
            <AnimatedButton onClick={onRetry}>
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Try Again
            </AnimatedButton>
          )}
          <AnimatedButton 
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </AnimatedButton>
        </div>
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-400 cursor-pointer mb-2">
              Technical Details (Dev Mode)
            </summary>
            <pre className="text-xs text-gray-500 bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

// Inline error component for form fields
export const InlineError = ({
  message,
  className = ''
}: {
  message: string;
  className?: string;
}) => {
  return (
    <FadeIn>
      <div className={`flex items-center mt-1 text-sm text-red-600 ${className}`}>
        <ExclamationCircleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
        <span>{message}</span>
      </div>
    </FadeIn>
  );
};

// Toast notification component
export const Toast = ({
  message,
  type = 'info',
  duration = 5000,
  onClose,
  className = ''
}: {
  message: string;
  type?: ErrorSeverity;
  duration?: number;
  onClose: () => void;
  className?: string;
}) => {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeConfig = {
    info: { bg: 'bg-blue-600', icon: InformationCircleIcon },
    warning: { bg: 'bg-yellow-600', icon: ExclamationTriangleIcon },
    error: { bg: 'bg-red-600', icon: XCircleIcon },
    success: { bg: 'bg-green-600', icon: CheckCircleIcon }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <FadeIn className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`${config.bg} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm flex items-center`}>
        <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
        <p className="text-sm flex-1">{message}</p>
        <button
          onClick={onClose}
          className="ml-3 text-white hover:text-gray-200 transition-colors"
        >
          <XCircleIcon className="w-4 h-4" />
        </button>
      </div>
    </FadeIn>
  );
};

// Network status indicator
export const NetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 text-sm z-50">
      <ExclamationTriangleIcon className="w-4 h-4 inline mr-2" />
      You are currently offline. Some features may not work properly.
    </div>
  );
};

// Retry wrapper component
export const RetryWrapper = ({
  children,
  onRetry,
  error,
  loading = false,
  maxRetries = 3,
  className = ''
}: {
  children: ReactNode;
  onRetry: () => void;
  error?: string | ErrorInfo;
  loading?: boolean;
  maxRetries?: number;
  className?: string;
}) => {
  const [retryCount, setRetryCount] = React.useState(0);

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      onRetry();
    }
  };

  if (error && !loading) {
    return (
      <div className={`p-4 ${className}`}>
        <ErrorAlert
          error={error}
          onRetry={retryCount < maxRetries ? handleRetry : undefined}
        />
        {retryCount >= maxRetries && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            Maximum retry attempts reached. Please refresh the page or contact support.
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
};