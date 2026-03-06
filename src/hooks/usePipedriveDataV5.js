// Pipedrive Data Hook V5 - Server-Side Filtering with filter_id
// Uses pre-created Pipedrive filter (ID: 215256) for optimal performance
// Only fetches property inspection activities from the server (197 total)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  fetchActivitiesForInspectorV5,
  fetchActivitiesWithFilter,
  healthCheck as pipedriveHealthCheck 
} from '../api/pipedriveRead.js';
import { 
  mockActivities, 
  inspectors, 
  getActivitiesByInspector,
  getActivitiesByInspectorAndDate 
} from '../data/mockActivities.js';
import { 
  PIPEDRIVE_USERS,
  getTestUser,
  getAllInspectors,
  hasValidPipedriveIds
} from '../config/pipedriveUsers.js';
import {
  getFilterForInspector,
  validateFilter,
  PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID
} from '../config/pipedriveFilters.js';

// Hook for managing Pipedrive V5 data (Server-Side Filtering) with fallback to mock data
export const usePipedriveDataV5 = (options = {}) => {
  const {
    autoFetch = true,
    cacheTimeout = 10 * 60 * 1000, // 10 minutes (longer since server-filtered)
    enableLiveData = import.meta.env.VITE_USE_LIVE_DATA === 'true'
  } = options;

  const [state, setState] = useState({
    activities: [],
    inspectors: [],
    loading: false,
    error: null,
    isLiveData: false,
    lastFetch: null,
    healthStatus: null,
    isTimeout: false,
    filterInfo: null
  });

  const [cache, setCache] = useState(new Map());

  // Check if we should use live data
  const shouldUseLiveData = useMemo(() => {
    console.log('🔧 PIPEDRIVE V5 DEBUG: Checking if should use live data...');
    console.log('   enableLiveData:', enableLiveData);
    console.log('   VITE_USE_LIVE_DATA:', import.meta.env.VITE_USE_LIVE_DATA);
    
    if (!enableLiveData) {
      console.log('❌ Live data disabled - using mock data');
      return false;
    }
    
    const validation = hasValidPipedriveIds();
    console.log('🔍 Pipedrive ID validation:', validation);
    
    const result = validation.testUser || validation.inspectors;
    console.log(result ? `✅ V5: Using live Pipedrive data with SERVER-SIDE FILTER (ID: ${PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID})` : '❌ No valid Pipedrive IDs - using mock data');
    
    return result;
  }, [enableLiveData]);

  // Validate the filter on first load
  useEffect(() => {
    const validateFilterInfo = async () => {
      if (shouldUseLiveData) {
        try {
          const validation = await validateFilter(PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID);
          setState(prev => ({ ...prev, filterInfo: validation }));
          
          if (!validation.valid) {
            console.error('❌ V5: Filter validation failed:', validation.error);
          } else {
            console.log('✅ V5: Filter validated successfully:', validation.filterName);
          }
        } catch (error) {
          console.error('❌ V5: Error validating filter:', error);
          setState(prev => ({ 
            ...prev, 
            filterInfo: { valid: false, error: error.message } 
          }));
        }
      }
    };
    
    validateFilterInfo();
  }, [shouldUseLiveData]);

  // Health check for Pipedrive API
  const checkHealth = useCallback(async () => {
    if (!shouldUseLiveData) {
      return { success: true, source: 'mock' };
    }

    try {
      console.log('🏥 V5: Checking Pipedrive API health...');
      const health = await pipedriveHealthCheck();
      
      setState(prev => ({ 
        ...prev, 
        healthStatus: { 
          ...health, 
          timestamp: new Date().toISOString() 
        } 
      }));
      
      return health;
    } catch (error) {
      console.error('❌ V5: Pipedrive health check failed:', error);
      
      const healthStatus = { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      setState(prev => ({ ...prev, healthStatus }));
      return healthStatus;
    }
  }, [shouldUseLiveData]);

  // Fetch activities with caching - V5 approach using SERVER-SIDE FILTERING
  const fetchActivities = useCallback(async (userId = null, startDate = null, endDate = null) => {
    const cacheKey = `v5_filtered_activities_${userId}_${startDate}_${endDate}`;
    const cachedData = cache.get(cacheKey);
    
    // Return cached data if it's still valid
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheTimeout) {
      console.log('📋 V5: Using cached SERVER-FILTERED activities data');
      return cachedData.data;
    }

    setState(prev => ({ ...prev, loading: true, error: null, isTimeout: false }));

    // Set up 3-second timeout for rate limiting feedback
    const timeoutId = setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        isTimeout: true,
        error: 'V5 API request taking longer than expected - possible rate limiting'
      }));
      console.log('⏰ V5 PIPEDRIVE TIMEOUT: Request taking > 3 seconds, likely rate limited');
    }, 3000);

    try {
      let activities = [];
      let isLiveData = false;

      if (shouldUseLiveData) {
        console.log('🔄 V5 DEBUG: Fetching SERVER-SIDE FILTERED Pipedrive data...');
        console.log(`   Filter ID: ${PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID} (197 activities)`);
        console.log('   userId:', userId);
        console.log('   startDate:', startDate);
        console.log('   endDate:', endDate);
        
        if (userId) {
          // Fetch for specific user only - using V5 SERVER-SIDE FILTERING
          const pipedriveUser = getAllInspectors().find(inspector => inspector.appId === userId);
          const testUser = getTestUser();
          
          console.log('🔍 V5 DEBUG: User lookup for server-filtered data:');
          console.log('   requested userId (appId):', userId);
          console.log('   found pipedriveUser:', pipedriveUser?.name, '(ID:', pipedriveUser?.id, ')');
          
          if (pipedriveUser?.id && pipedriveUser?.name) {
            console.log(`📞 V5 SERVER FILTER: Fetching activities for ${pipedriveUser.name} (ID: ${pipedriveUser.id})`);
            console.log(`   📅 Using server filter ${PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID} - MUCH MORE EFFICIENT!`);
            
            // Limit to next 2 weeks for better performance
            const today = new Date();
            const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
            const limitedStartDate = startDate || today.toISOString().split('T')[0];
            const limitedEndDate = endDate || twoWeeksFromNow.toISOString().split('T')[0];
            
            // Use V5 approach - check if inspector has specific filter
            const inspectorFilterId = getFilterForInspector(pipedriveUser.appId);
            const filterId = inspectorFilterId || PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID;
            
            console.log(`🎯 V5: Using filter ${filterId} for ${pipedriveUser.name} (appId: ${pipedriveUser.appId})`);
            if (inspectorFilterId) {
              console.log(`   ✅ Using dedicated server filter for this inspector`);
            } else {
              console.log(`   ⚠️ No dedicated filter, will fallback to client-side filtering`);
            }
            
            activities = await fetchActivitiesForInspectorV5(
              pipedriveUser.id, 
              pipedriveUser.name,
              filterId,
              limitedStartDate, 
              limitedEndDate
            );
            console.log(`✅ V5 SERVER FILTER: Received ${activities.length} activities for ${pipedriveUser.name}`);
            isLiveData = true;
          } else if (testUser.id && userId === 'test') {
            console.log(`📞 V5 SERVER FILTER: Fetching activities for test user ${testUser.name} (ID: ${testUser.id})`);
            
            // Limit to next 2 weeks for test user too
            const today = new Date();
            const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
            const limitedStartDate = startDate || today.toISOString().split('T')[0];
            const limitedEndDate = endDate || twoWeeksFromNow.toISOString().split('T')[0];
            
            // Test user doesn't have a specific filter, use fallback
            activities = await fetchActivitiesForInspectorV5(
              testUser.id, 
              testUser.name,
              null, // No specific filter for test user - will trigger fallback
              limitedStartDate, 
              limitedEndDate
            );
            console.log(`✅ V5 SERVER FILTER: Received ${activities.length} activities for test user`);
            isLiveData = true;
          } else {
            console.warn('⚠️ V5 DEBUG: User not found in configuration, falling back to mock');
            console.warn('   Available inspectors:', getAllInspectors().map(i => ({appId: i.appId, name: i.name, id: i.id})));
            activities = getActivitiesByInspector(userId);
          }
        } else {
          // No specific user requested - show server-filtered results for all inspectors
          console.log('📝 V5 DEBUG: No specific user requested - fetching all server-filtered activities');
          console.log('   (This will show ALL 197 property inspection activities)');
          
          // Fetch all server-filtered activities
          const today = new Date();
          const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
          const limitedStartDate = startDate || today.toISOString().split('T')[0];
          const limitedEndDate = endDate || twoWeeksFromNow.toISOString().split('T')[0];
          
          const rawActivities = await fetchActivitiesWithFilter(
            PIPEDRIVE_PROPERTY_INSPECTION_FILTER_ID,
            limitedStartDate,
            limitedEndDate
          );
          
          // Transform the raw activities
          const { transformPipedriveActivity } = await import('../api/pipedriveRead.js');
          activities = rawActivities
            .map(transformPipedriveActivity)
            .filter(activity => activity !== null);
            
          console.log(`✅ V5 SERVER FILTER: Received ${activities.length} total property inspection activities`);
          isLiveData = shouldUseLiveData;
        }
      } else {
        console.log('📋 V5: Using mock data (live data disabled)');
        activities = userId ? getActivitiesByInspector(userId) : mockActivities;
      }

      // Cache the results
      const cacheData = {
        data: activities,
        timestamp: Date.now(),
        isLiveData
      };
      
      const newCache = new Map(cache);
      newCache.set(cacheKey, cacheData);
      setCache(newCache);

      // Clear timeout and update success state
      clearTimeout(timeoutId);
      
      setState(prev => ({
        ...prev,
        activities,
        loading: false,
        isLiveData,
        lastFetch: new Date().toISOString(),
        error: null,
        isTimeout: false
      }));

      // Debug: Add activities to window for testing
      window.debugActivitiesV5Filtered = activities;
      console.log('🧪 V5 DEBUG: Added', activities.length, 'SERVER-FILTERED activities to window.debugActivitiesV5Filtered');

      return activities;

    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      
      console.error('❌ V5: Error fetching SERVER-FILTERED activities:', error);
      
      // No fallback to mock data - show error state
      console.log('❌ V5 NO FALLBACK: Showing error state instead of mock data');
      
      setState(prev => ({
        ...prev,
        activities: [], // Empty array, no mock fallback
        loading: false,
        isLiveData: false,
        error: `V5 (Server Filter): ${error.message}`,
        isTimeout: false
      }));

      return [];
    }
  }, [shouldUseLiveData, cache, cacheTimeout]);

  // Get activities for specific inspector and date
  const getInspectorActivities = useCallback(async (inspectorId, date = null) => {
    try {
      let activities;

      if (shouldUseLiveData) {
        const inspector = getAllInspectors().find(inspector => inspector.appId === inspectorId);
        const testUser = getTestUser();
        
        if (inspector?.id && inspector?.name) {
          const dateString = date ? date : null;
          // Use V5 approach - check if inspector has specific filter
          const inspectorFilterId = getFilterForInspector(inspector.appId);
          const filterId = inspectorFilterId || null; // Use null to trigger fallback
          
          activities = await fetchActivitiesForInspectorV5(
            inspector.id, 
            inspector.name,
            filterId,
            dateString, 
            dateString
          );
          console.log(`🔍 V5 SERVER FILTER: Fetched ${activities.length} activities for ${inspector.name} on ${dateString || 'all dates'}`);
        } else if (testUser.id && inspectorId === 'test') {
          const dateString = date ? date : null;
          // Test user doesn't have a specific filter
          activities = await fetchActivitiesForInspectorV5(
            testUser.id, 
            testUser.name,
            null, // No specific filter for test user
            dateString, 
            dateString
          );
          console.log(`🔍 V5 SERVER FILTER: Fetched ${activities.length} activities for test user on ${dateString || 'all dates'}`);
        } else {
          // Fallback to mock data
          activities = date 
            ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
            : getActivitiesByInspector(inspectorId);
        }
      } else {
        activities = date 
          ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
          : getActivitiesByInspector(inspectorId);
      }

      return activities;
    } catch (error) {
      console.error('❌ V5: Error fetching SERVER-FILTERED inspector activities:', error);
      
      // Fallback to mock data
      return date 
        ? getActivitiesByInspectorAndDate(inspectorId, new Date(date))
        : getActivitiesByInspector(inspectorId);
    }
  }, [shouldUseLiveData]);

  // Clear cache
  const clearCache = useCallback(() => {
    setCache(new Map());
    console.log('🧹 V5: Pipedrive SERVER-FILTERED data cache cleared');
  }, []);

  // Refresh data (bypass cache)
  const refresh = useCallback(async (userId = null, startDate = null, endDate = null) => {
    clearCache();
    return await fetchActivities(userId, startDate, endDate);
  }, [fetchActivities, clearCache]);

  // Get inspector list (mix of configured Pipedrive users and mock data)
  const getInspectorList = useCallback(() => {
    if (shouldUseLiveData) {
      // Return configured inspectors with Pipedrive IDs
      const configuredInspectors = getAllInspectors()
        .filter(inspector => inspector.id !== null)
        .map(inspector => ({
          id: inspector.appId,
          name: inspector.name,
          email: inspector.email,
          region: inspector.region,
          pipedriveId: inspector.id,
          isFromPipedrive: true
        }));

      // Add test user if configured
      const testUser = getTestUser();
      if (testUser.id) {
        configuredInspectors.push({
          id: 'test',
          name: testUser.name,
          email: testUser.email,
          region: testUser.region,
          pipedriveId: testUser.id,
          isTestUser: true,
          isFromPipedrive: true
        });
      }

      // Fallback to mock data if no Pipedrive users are configured
      return configuredInspectors.length > 0 ? configuredInspectors : inspectors;
    }

    return inspectors;
  }, [shouldUseLiveData]);

  // Initialize data on mount
  useEffect(() => {
    if (autoFetch) {
      fetchActivities();
    }
  }, [autoFetch, fetchActivities]);

  // Return hook interface
  return {
    // Data
    activities: state.activities,
    inspectors: getInspectorList(),
    
    // State
    loading: state.loading,
    error: state.error,
    isLiveData: state.isLiveData,
    lastFetch: state.lastFetch,
    healthStatus: state.healthStatus,
    isTimeout: state.isTimeout,
    filterInfo: state.filterInfo,
    
    // Configuration
    shouldUseLiveData,
    enableLiveData,
    
    // Methods
    fetchActivities,
    getInspectorActivities,
    checkHealth,
    refresh,
    clearCache,
    
    // Cache info
    cacheSize: cache.size,
    cacheTimeout
  };
};

// Hook specifically for activity data with date filtering - V5 version
export const usePipedriveActivitiesV5 = (inspectorId = null, date = null) => {
  const {
    activities,
    loading,
    error,
    isLiveData,
    getInspectorActivities,
    refresh
  } = usePipedriveDataV5({
    autoFetch: false // We'll fetch manually based on params
  });

  const [filteredActivities, setFilteredActivities] = useState([]);

  // Fetch activities when params change
  useEffect(() => {
    const loadActivities = async () => {
      if (inspectorId) {
        const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
        const activities = await getInspectorActivities(inspectorId, dateString);
        setFilteredActivities(activities);
      } else {
        setFilteredActivities([]);
      }
    };

    loadActivities();
  }, [inspectorId, date, getInspectorActivities]);

  return {
    activities: filteredActivities,
    loading,
    error,
    isLiveData,
    refresh: () => refresh(inspectorId, date, date)
  };
};

export default usePipedriveDataV5;