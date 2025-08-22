import React from 'react';
import { AlertTriangle, Database, Wrench, RefreshCw } from 'lucide-react';

interface DatabaseErrorHandlerProps {
  error: any;
  onRetry?: () => void;
}

export function DatabaseErrorHandler({ error, onRetry }: DatabaseErrorHandlerProps) {
  // Check if this is the specific rental blocking columns error
  const isRentalBlockingError = error?.response?.data?.detail?.includes('is_rental_blocked') ||
                               error?.response?.data?.detail?.includes('rental_block_reason') ||
                               error?.response?.data?.detail?.includes('column') && error?.response?.data?.detail?.includes('does not exist');

  // Check if this is a database schema error
  const isDatabaseSchemaError = error?.response?.data?.detail?.includes('ProgrammingError') ||
                               error?.response?.data?.detail?.includes('UndefinedColumnError') ||
                               error?.response?.data?.detail?.includes('sqlalchemy');

  if (isRentalBlockingError || isDatabaseSchemaError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-lg shadow-lg border border-red-200">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <Database className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    Database Schema Update Required
                  </h1>
                  <p className="text-sm text-gray-600">
                    The database needs to be updated to support the latest features
                  </p>
                </div>
              </div>

              {/* Error Details */}
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Missing Database Columns
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      The rental blocking feature requires additional database columns that haven't been created yet.
                    </p>
                    {error?.response?.data?.detail && (
                      <details className="mt-2">
                        <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                          Technical Details
                        </summary>
                        <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap bg-red-100 p-2 rounded overflow-x-auto">
                          {error.response.data.detail}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>

              {/* Solution Steps */}
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Wrench className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Quick Fix Available</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      A database administrator can quickly resolve this by applying the schema update.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">For Database Administrators:</h4>
                  <div className="text-sm text-blue-800 space-y-2">
                    <p>1. Access the Railway database console</p>
                    <p>2. Run the SQL commands from <code className="bg-blue-100 px-1 rounded">EMERGENCY_DB_FIX.sql</code></p>
                    <p>3. Refresh this page to continue</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-amber-900 mb-2">Alternative Solutions:</h4>
                  <div className="text-sm text-amber-800 space-y-1">
                    <p>• Wait for automatic deployment (if pending)</p>
                    <p>• Contact system administrator</p>
                    <p>• Check the debug dashboard for system status</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </button>
                )}
                <a
                  href="/debug"
                  className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  <Database className="h-4 w-4 mr-2" />
                  System Status
                </a>
                <a
                  href="/"
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Return to Dashboard
                </a>
              </div>

              {/* Help Text */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  This error typically occurs after deploying new features that require database schema changes. 
                  The fix is straightforward and usually takes less than a minute to apply.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For other errors, return null to let the parent component handle them
  return null;
}