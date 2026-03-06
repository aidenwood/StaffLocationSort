import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, User, Clock, AlertCircle, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { fetchActivitiesWithFilterV2, enrichActivitiesWithAddresses } from '../api/pipedriveRead.js';
import { PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID } from '../config/pipedriveFilters.js';
import { getAllInspectors } from '../config/pipedriveUsers.js';
import ApiTestButton from './ApiTestButton.jsx';
import { formatActivityTime, shouldShowDSTToggle, isNSWDaylightSaving } from '../utils/timezone.js';

const SimpleActivityList = () => {
  const [selectedInspector, setSelectedInspector] = useState(2); // Ben Thompson
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forceDST, setForceDST] = useState(null); // null = auto, true = force AEDT, false = force AEST

  const inspectors = getAllInspectors();
  const currentInspector = inspectors.find(i => i.appId === selectedInspector);

  const fetchInspectorActivities = async (inspectorAppId) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Fetching activities for inspector ${inspectorAppId}`);
      console.log('🔧 Environment check:');
      console.log('   API Key exists:', !!import.meta.env.VITE_PIPEDRIVE_API_KEY);
      console.log('   Use live data:', import.meta.env.VITE_USE_LIVE_DATA);
      console.log('   Filter ID:', PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID);
      console.log('   Inspector config:', inspectors.find(i => i.appId === inspectorAppId));
      
      // Get all activities using server-side filter (should return ~188 activities)
      const allActivities = await fetchActivitiesWithFilterV2(
        PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID
        // No date limits to get all 188 activities
      );

      console.log(`📊 Got ${allActivities.length} total activities from filter`);

      // Filter for this specific inspector and sort by due date
      const inspectorActivities = allActivities
        .filter(activity => {
          // Match by user_id/owner_id (Pipedrive ID)
          const pipedriveUserId = activity.user_id || activity.owner_id;
          const inspector = inspectors.find(i => i.appId === inspectorAppId);
          return pipedriveUserId === inspector?.id;
        })
        .sort((a, b) => {
          const dateA = new Date(a.due_date || '2999-12-31');
          const dateB = new Date(b.due_date || '2999-12-31');
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 20); // Take only first 20

      console.log(`✅ Filtered to ${inspectorActivities.length} activities for inspector ${inspectorAppId}`);
      
      // 🏠 Enrich activities with person addresses
      console.log('🔍 Enriching activities with person addresses...');
      const enrichedActivities = await enrichActivitiesWithAddresses(inspectorActivities);
      
      setActivities(enrichedActivities);
    } catch (err) {
      console.error('❌ Error fetching inspector activities:', err);
      setError(err.message);
      setActivities([]); // No mock data - show real error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedInspector) {
      fetchInspectorActivities(selectedInspector);
    }
  }, [selectedInspector]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Inspector Activity List
        </h1>
        <p className="text-gray-600">
          Showing next 20 upcoming activities by due date
        </p>
      </div>

      {/* Connection Status */}
      <ApiTestButton />

      {/* Inspector Selection */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <label className="text-sm font-medium text-gray-700">
            Select Inspector:
          </label>
          
          {/* Daylight Savings Toggle - only show for NSW inspectors */}
          {currentInspector && shouldShowDSTToggle(currentInspector.region) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Time Zone:</span>
              <button
                onClick={() => setForceDST(forceDST === null ? false : forceDST === false ? true : null)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs border hover:bg-gray-50"
                title="Toggle daylight saving time"
              >
                {forceDST === null ? (
                  <>
                    <Clock className="h-3 w-3" />
                    Auto {isNSWDaylightSaving() ? 'AEDT' : 'AEST'}
                  </>
                ) : forceDST ? (
                  <>
                    <Sun className="h-3 w-3 text-orange-500" />
                    AEDT
                  </>
                ) : (
                  <>
                    <Moon className="h-3 w-3 text-blue-500" />
                    AEST
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        
        <select
          value={selectedInspector}
          onChange={(e) => setSelectedInspector(Number(e.target.value))}
          className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {inspectors.map(inspector => (
            <option key={inspector.appId} value={inspector.appId}>
              {inspector.name} ({inspector.region})
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading activities...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Activities</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={() => fetchInspectorActivities(selectedInspector)}
                className="mt-3 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activities List */}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentInspector?.name}'s Next 20 Activities
            </h2>
            <span className="text-sm text-gray-500">
              {activities.length} activities found
            </span>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No activities found for {currentInspector?.name}
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={activity.id || index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        {activity.subject || 'No Subject'}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                          <span>
                            {activity.due_date 
                              ? format(new Date(activity.due_date), 'MMM dd, yyyy')
                              : 'No date'
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-green-500" />
                          <span>
                            {formatActivityTime(
                              activity.due_time || '09:00', 
                              currentInspector?.region || 'QLD', 
                              forceDST
                            )}
                          </span>
                        </div>
                        
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-red-500" />
                          <span className="truncate">
                            {activity.personAddress || activity.location || 'No address available'}
                          </span>
                        </div>
                      </div>

                      {activity.note && (
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                          {activity.note}
                        </p>
                      )}
                    </div>
                    
                    <div className="ml-4">
                      <span className="text-xs text-gray-400">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleActivityList;