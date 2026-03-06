import React, { useState, useEffect, useRef } from 'react';

const ApiDebugConsole = ({ 
  isOpen, 
  onClose, 
  debugData, 
  onPauseChange, 
  activities, 
  inspectors, 
  selectedInspector, 
  loading, 
  error, 
  isLiveData 
}) => {
  const [activeTab, setActiveTab] = useState('activities');
  const [isPaused, setIsPaused] = useState(false);
  const consoleRef = useRef(null);

  useEffect(() => {
    if (consoleRef.current && !isPaused) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [debugData?.consoleLogs, isPaused]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'activities', label: 'Activities Data', icon: '🎯' },
    { id: 'console', label: 'Console Logs', icon: '📜' },
    { id: 'api-response', label: 'API Response', icon: '🔄' },
    { id: 'transformed-map', label: 'Transformed (Map)', icon: '🗺️' },
    { id: 'transformed-calendar', label: 'Transformed (Calendar)', icon: '📅' }
  ];

  const formatJsonData = (data) => {
    if (!data) return 'No data available';
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Error formatting data: ${error.message}`;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'activities':
        const selectedInspectorInfo = inspectors?.find(i => i.id === selectedInspector);
        return (
          <div className="h-64 overflow-y-auto">
            <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
              <div className="font-semibold mb-2">Current Data Status:</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
                  <div><strong>Error:</strong> {error ? 'Yes' : 'No'}</div>
                  <div><strong>Live Data:</strong> {isLiveData ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div><strong>Activities Count:</strong> {activities?.length || 0}</div>
                  <div><strong>Selected Inspector:</strong> {selectedInspectorInfo?.name || 'None'} (ID: {selectedInspector})</div>
                </div>
              </div>
              {error && (
                <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-xs">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </div>
            <div className="mb-2 text-sm font-semibold">
              Activities Data ({activities?.length || 0} items):
            </div>
            <pre className="bg-gray-100 p-4 rounded text-xs">
              {formatJsonData(activities?.slice(0, 10))} {/* Show first 10 items */}
            </pre>
            {activities?.length > 10 && (
              <div className="mt-2 text-xs text-gray-600">
                Showing first 10 of {activities.length} activities
              </div>
            )}
          </div>
        );

      case 'console':
        return (
          <div 
            ref={consoleRef}
            className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto"
          >
            {isPaused && (
              <div className="bg-yellow-900 text-yellow-300 p-2 mb-2 rounded text-center text-xs">
                ⏸️ Console logging is paused
              </div>
            )}
            {debugData?.consoleLogs?.length > 0 ? (
              debugData.consoleLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                  <span className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>
                    {log.level.toUpperCase()}:
                  </span>{' '}
                  <span>{log.message}</span>
                  {log.data && (
                    <pre className="ml-4 text-blue-300 text-xs">
                      {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data}
                    </pre>
                  )}
                </div>
              ))
            ) : (
              <div className="text-gray-500">No console logs available</div>
            )}
          </div>
        );

      case 'api-response':
        return (
          <div className="h-64 overflow-y-auto">
            <pre className="bg-gray-100 p-4 rounded text-sm">
              {formatJsonData(debugData?.apiResponse)}
            </pre>
          </div>
        );

      case 'transformed-map':
        return (
          <div className="h-64 overflow-y-auto">
            <div className="mb-2 text-sm text-gray-600">
              Activities transformed for map view ({debugData?.transformedData?.map?.length || 0} items)
            </div>
            <pre className="bg-gray-100 p-4 rounded text-sm">
              {formatJsonData(debugData?.transformedData?.map)}
            </pre>
          </div>
        );

      case 'transformed-calendar':
        return (
          <div className="h-64 overflow-y-auto">
            <div className="mb-2 text-sm text-gray-600">
              Activities transformed for calendar view ({debugData?.transformedData?.calendar?.length || 0} items)
            </div>
            <pre className="bg-gray-100 p-4 rounded text-sm">
              {formatJsonData(debugData?.transformedData?.calendar)}
            </pre>
          </div>
        );

      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">API Debug Console</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newPausedState = !isPaused;
                setIsPaused(newPausedState);
                onPauseChange?.(newPausedState);
              }}
              className={`px-3 py-1 rounded text-xs font-medium ${
                isPaused 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <div className="text-xs text-gray-500">
              Last updated: {debugData?.lastUpdated ? new Date(debugData.lastUpdated).toLocaleTimeString() : 'Never'}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'activities' && activities?.length > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                  {activities.length}
                </span>
              )}
              {tab.id === 'console' && debugData?.consoleLogs?.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {debugData.consoleLogs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-4">
          {renderTabContent()}
        </div>

        {/* Footer Stats */}
        <div className="border-t p-3 bg-gray-50 text-xs text-gray-600 flex justify-between">
          <div>
            API Status: {debugData?.apiStatus || 'Unknown'} | 
            Source: {debugData?.dataSource || 'Unknown'} |
            Response Time: {debugData?.responseTime || 'N/A'}ms
          </div>
          <div>
            Raw Activities: {debugData?.apiResponse?.length || 0} | 
            Map Items: {debugData?.transformedData?.map?.length || 0} | 
            Calendar Items: {debugData?.transformedData?.calendar?.length || 0}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDebugConsole;