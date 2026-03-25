import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  useEffect(() => {
    // Don't auto-hide loading toasts
    if (type === 'loading') return;
    
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose, type]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'loading':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStyles = () => {
    const baseStyles = "fixed bottom-16 left-1/2 transform -translate-x-1/2 z-50 p-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm";
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border border-green-200 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border border-red-200 text-red-800`;
      case 'loading':
        return `${baseStyles} bg-blue-50 border border-blue-200 text-blue-800`;
      default:
        return `${baseStyles} bg-blue-50 border border-blue-200 text-blue-800`;
    }
  };

  return (
    <div className={getStyles()}>
      {getIcon()}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

export default Toast;