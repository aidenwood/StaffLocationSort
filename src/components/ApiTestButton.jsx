import React, { useState, useEffect } from 'react';
import { fetchActivitiesWithFilterV2 } from '../api/pipedriveRead.js';
import { PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID } from '../config/pipedriveFilters.js';

const ApiTestButton = () => {
  const [status, setStatus] = useState({ loading: true, connected: false, totalActivities: 0 });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('🔍 Checking Pipedrive connection and total activities...');
        
        // Get all activities from filter 215315 (the working approach)
        const activities = await fetchActivitiesWithFilterV2(PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID);
        
        setStatus({
          loading: false,
          connected: true,
          totalActivities: activities.length
        });
        
        console.log(`✅ Pipedrive connected: ${activities.length} total Property Inspections found`);
        
      } catch (error) {
        console.error('❌ Pipedrive connection failed:', error);
        setStatus({
          loading: false,
          connected: false,
          totalActivities: 0,
          error: error.message
        });
      }
    };

    checkConnection();
  }, []);

  if (status.loading) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm mb-6">
        <div className="w-3 h-3 mr-2 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        Connecting to Pipedrive...
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm mb-6">
        <span className="w-2 h-2 mr-2 bg-red-500 rounded-full"></span>
        Pipedrive Connection Failed
        {status.error && (
          <span className="ml-1 text-xs">• {status.error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm mb-6">
      <span className="w-2 h-2 mr-2 bg-green-500 rounded-full"></span>
      ✅ Pipedrive Connected • {status.totalActivities} Property Inspections Found
    </div>
  );
};

export default ApiTestButton;