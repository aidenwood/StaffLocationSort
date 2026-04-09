import React from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error 
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for debugging - only keep console.error for actual errors
    console.error('Component crashed:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
    
    // Send to error tracking service in production
    // if (process.env.NODE_ENV === 'production') {
    //   sendToErrorTracking(error, errorInfo);
    // }
  }

  handleRefresh = () => {
    window.location.reload();
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="min-h-96 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200 p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-lg font-semibold">Something went wrong</h2>
            </div>
            
            <div className="text-gray-600 mb-6">
              <p className="mb-2">An unexpected error occurred in this component.</p>
              
              {this.state.error && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Error Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700 overflow-auto max-h-32">
                    {this.state.error.message}
                  </div>
                </details>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button 
                onClick={this.handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
            </div>
            
            {this.props.showReportButton && (
              <button
                onClick={() => window.open('https://github.com/anthropics/claude-code/issues', '_blank')}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <Bug className="w-4 h-4" />
                Report Issue
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;