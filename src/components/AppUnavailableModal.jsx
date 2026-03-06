import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const AppUnavailableModal = ({ isOpen, onRetry, errorCount, lastError }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-center mb-4">
          <div className="bg-red-100 rounded-full p-3 mr-4">
            <WifiOff className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Service Unavailable</h2>
            <p className="text-gray-600 text-sm">Pipedrive API connection failed</p>
          </div>
        </div>

        {/* Error Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-800 mb-2">
                The application cannot connect to Pipedrive after {errorCount} attempts.
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Possible causes:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>API rate limiting (429 errors)</li>
                  <li>Network connectivity issues</li>
                  <li>Pipedrive service maintenance</li>
                  <li>Invalid API credentials</li>
                </ul>
              </div>
              {lastError && (
                <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                  <strong>Last error:</strong> {lastError.substring(0, 100)}
                  {lastError.length > 100 && '...'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="text-gray-500 hover:text-gray-700 text-sm underline"
            >
              Refresh Page
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            If this issue persists, please check your internet connection or contact support.
            The app will automatically retry with exponential backoff.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppUnavailableModal;