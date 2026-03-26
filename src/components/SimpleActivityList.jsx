import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, MapPin, User, Clock, AlertCircle, Sun, Moon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { enrichActivitiesWithAddresses } from '../api/pipedriveRead.js';
import ApiTestButton from './ApiTestButton.jsx';
import { formatActivityTime, shouldShowDSTToggle, isNSWDaylightSaving } from '../utils/timezone.js';

const SimpleActivityList = ({ pipedriveData, onActivitiesEnriched }) => {
  const [selectedInspector, setSelectedInspector] = useState('all'); // Start with 'All Inspectors' view
  const [forceDST, setForceDST] = useState(null); // null = auto, true = force AEDT, false = force AEST
  const [enrichedActivities, setEnrichedActivities] = useState([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });

  // Use shared Pipedrive data from App.jsx
  const {
    activities: allActivities,
    inspectors,
    loading,
    error,
    isLiveData
  } = pipedriveData;

  const currentInspector = selectedInspector === 'all' 
    ? null 
    : inspectors.find(i => i.id === selectedInspector);

  // Filter and sort activities for the selected inspector
  const filteredActivities = useMemo(() => {
    if (!allActivities || allActivities.length === 0) return [];

    let filtered = allActivities;
    
    // Filter by inspector if not 'all'
    if (selectedInspector !== 'all') {
      filtered = filtered.filter(activity => {
        return Number(activity.owner_id) === Number(selectedInspector);
      });
    }
    
    // Sort by date
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.due_date || '2999-12-31');
      const dateB = new Date(b.due_date || '2999-12-31');
      return dateA.getTime() - dateB.getTime();
    });
    
    // Show ALL activities - no slicing to see everything
    return filtered;
  }, [allActivities, selectedInspector]);

  // Enrich the filtered activities with person addresses
  useEffect(() => {
    if (filteredActivities.length === 0) {
      setEnrichedActivities([]);
      return;
    }

    const enrich = async () => {
      setEnriching(true);
      setEnrichmentProgress({ current: 0, total: filteredActivities.length, cached: 0, processing: 0 });
      
      try {
        // Do the actual enrichment with real progress updates
        const finalEnriched = await enrichActivitiesWithAddresses(
          filteredActivities,
          (progress) => {
            setEnrichmentProgress(progress);
          }
        );
        setEnrichedActivities(finalEnriched);
        onActivitiesEnriched?.(finalEnriched);
      } catch (err) {
        console.error('Address enrichment failed:', err);
        setEnrichedActivities(filteredActivities);
      } finally {
        setEnriching(false);
      }
    };

    enrich();
  }, [filteredActivities]);

  // Sort activities to put ones without addresses at the top for debugging
  const activities = useMemo(() => {
    if (selectedInspector !== 'all') {
      return enrichedActivities; // Normal sorting for individual inspectors
    }
    
    // For 'All Inspectors' view, sort no-address activities to the top
    return [...enrichedActivities].sort((a, b) => {
      const aHasAddress = !!(a.personAddress || a.location?.value || (typeof a.location === 'string' && a.location));
      const bHasAddress = !!(b.personAddress || b.location?.value || (typeof b.location === 'string' && b.location));
      
      // If one has address and other doesn't, put no-address first
      if (!aHasAddress && bHasAddress) return -1;
      if (aHasAddress && !bHasAddress) return 1;
      
      // Otherwise sort by date
      const dateA = new Date(a.due_date || '2999-12-31');
      const dateB = new Date(b.due_date || '2999-12-31');
      return dateA.getTime() - dateB.getTime();
    });
  }, [enrichedActivities, selectedInspector]);

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
      
      {/* Data Discrepancy Debug Info */}
      {selectedInspector === 'all' && allActivities && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-sm">
          <div className="font-medium text-blue-900 mb-1">Activity Breakdown:</div>
          <div className="text-blue-800">
            • Total in Pipedrive filter: Check header above ↑<br/>
            • Upcoming activities (today+): {allActivities.length}<br/>
            • After address enrichment: {activities.length}<br/>
            • Missing addresses: {activities.filter(a => !(a.personAddress || a.location?.value || (typeof a.location === 'string' && a.location))).length}<br/>
            <span className="text-gray-600 text-xs mt-1 block">
              📅 Note: Only showing activities with due_date ≥ today. Past activities are hidden.
            </span>
          </div>
        </div>
      )}

      {/* Inspector Selection */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <label className="text-sm font-medium text-gray-700">
            Select Inspector:
          </label>

          {/* Daylight Savings Toggle - only show for NSW inspectors */}
          {currentInspector && shouldShowDSTToggle(currentInspector.region || currentInspector.regionName) && (
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
          onChange={(e) => {
            const value = e.target.value;
            setSelectedInspector(value === 'all' ? 'all' : Number(value));
          }}
          className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all" className="font-semibold bg-gray-50">
            🔍 All Inspectors (Debug View)
          </option>
          <optgroup label="Individual Inspectors">
            {inspectors.map(inspector => (
              <option key={inspector.id} value={inspector.id}>
                {inspector.name} ({inspector.region || inspector.regionName})
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Loading State */}
      {(loading || enriching) && (
        <div className="py-8">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">
              {loading ? 'Loading activities...' : 
                enrichmentProgress.cached ? 
                  `Enriching addresses... (${enrichmentProgress.current}/${enrichmentProgress.total} - ${enrichmentProgress.cached} from cache)` :
                  `Enriching addresses... (${enrichmentProgress.current}/${enrichmentProgress.total})`
              }
            </span>
          </div>
          {enriching && enrichmentProgress.total > 0 && (
            <div className="max-w-md mx-auto">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${(enrichmentProgress.current / enrichmentProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>
                  {enrichmentProgress.currentBatch && enrichmentProgress.totalBatches ? 
                    `Batch ${enrichmentProgress.currentBatch}/${enrichmentProgress.totalBatches}` :
                    'Preparing...'
                  }
                </span>
                <span>
                  {enrichmentProgress.cached > 0 && 
                    `📦 ${enrichmentProgress.cached} cached, 🆕 ${enrichmentProgress.processing} new`
                  }
                </span>
              </div>
            </div>
          )}
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
                onClick={() => pipedriveData.refresh?.()}
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
              {selectedInspector === 'all' 
                ? `All Inspectors (${activities.length} activities) - ${activities.filter(a => !(a.personAddress || a.location?.value || (typeof a.location === 'string' && a.location))).length} Missing Addresses`
                : `${currentInspector?.name}'s Activities (${activities.length})`
              }
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
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    selectedInspector === 'all' && !(activity.personAddress || activity.location?.value || (typeof activity.location === 'string' && activity.location))
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900">
                          {activity.subject || 'No Subject'}
                        </h3>
                        {selectedInspector === 'all' && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            <User className="inline h-3 w-3 mr-1" />
                            {inspectors.find(i => i.id === activity.owner_id)?.name || `Inspector #${activity.owner_id}`}
                          </span>
                        )}
                      </div>
                      
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
                            {selectedInspector === 'all' 
                              ? activity.due_time || '09:00' // Show raw time for all inspectors
                              : formatActivityTime(
                                  activity.due_time || '09:00',
                                  currentInspector?.region || currentInspector?.regionName || 'QLD',
                                  forceDST
                                )
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-red-500" />
                          <span className="truncate">
                            {activity.personAddress || activity.location?.value || (typeof activity.location === 'string' ? activity.location : null) || 'No address available'}
                          </span>
                          {activity.coordinates && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              📍 {activity.coordinates.lat?.toFixed(4)}, {activity.coordinates.lng?.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>

                      {activity.note && (
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                          {activity.note}
                        </p>
                      )}
                      
                      {/* Open in Pipedrive */}
                      {(activity.deal_id || activity.id) && (
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <a
                            href={activity.deal_id 
                              ? `https://rebuildrelief.pipedrive.com/deal/${activity.deal_id}`
                              : `https://rebuildrelief.pipedrive.com/activity/${activity.id}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>{activity.deal_id ? 'Open Deal in Pipedrive' : 'Open Activity in Pipedrive'}</span>
                          </a>
                        </div>
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